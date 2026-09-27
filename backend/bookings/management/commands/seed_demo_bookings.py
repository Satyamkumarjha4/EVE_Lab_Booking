import random
from collections import Counter
from datetime import date, datetime, timedelta

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import User
from catalog.management.commands.seed_demo_data import DEMO_LAB_NAME, DEMO_PASSWORD
from catalog.models import CentreTest
from payments.models import Payment
from scheduling.services import local_tz, rules_for_day, slot_times

from ...models import Booking, BookingEvent
from ..demo_stories import tell

HISTORY_DAYS = 90
LOCAL_TZ = local_tz()
S = Booking.Status

# (email, first name, last name, phone, date of birth, gender)
DEMO_PATIENTS = [
    ("patient1@demo.eve", "Aarav", "Mehta", "+91 98100 11001", date(1988, 3, 14), "MALE"),
    ("patient2@demo.eve", "Diya", "Kapoor", "+91 98100 11002", date(1994, 7, 2), "FEMALE"),
    ("patient3@demo.eve", "Kabir", "Singh", "+91 98100 11003", date(1979, 11, 23), "MALE"),
    ("patient4@demo.eve", "Ananya", "Iyer", "+91 98100 11004", date(2001, 1, 9), "FEMALE"),
    ("patient5@demo.eve", "Rohan", "Das", "+91 98100 11005", date(1965, 5, 30), "MALE"),
    ("patient6@demo.eve", "Meera", "Nair", "+91 98100 11006", date(1990, 9, 17), "FEMALE"),
    ("patient7@demo.eve", "Arjun", "Rao", "+91 98100 11007", date(1983, 12, 5), "MALE"),
    ("patient8@demo.eve", "Sara", "Khan", "+91 98100 11008", date(1998, 4, 21), "FEMALE"),
]
DEMO_CLIENT = ("client@demo.eve", "Riya", "Sharma", "+91 98100 10000", date(1992, 6, 18), "FEMALE")

WALK_IN_RATE = 0.3
# Upper bound of bookings per centre per day; the demo lab gets more so its dashboard is busy.
DAILY_MAX = {"demo_lab": 3, "other": 1}

PAST_OUTCOMES = {
    S.REPORT_DELIVERED: 50,
    S.COMPLETED: 16,
    S.NO_SHOW: 6,
    S.FAILED: 12,
    S.CANCELLED: 16,
}
UPCOMING_OUTCOMES = {S.CONFIRMED: 72, S.CANCELLED: 12, S.FAILED: 10, S.PENDING: 6}

# (days from now, outcome) for the documented client@demo.eve login, so "My bookings" shows
# every stage of the lifecycle out of the box.
DEMO_CLIENT_BOOKINGS = [
    (3, S.CONFIRMED),
    (6, S.CONFIRMED),
    (2, S.PENDING),
    (-4, S.COMPLETED),
    (-12, S.REPORT_DELIVERED),
    (-30, S.REPORT_DELIVERED),
    (-9, S.NO_SHOW),
    (-20, S.CANCELLED),
    (-45, S.FAILED),
]


class Command(BaseCommand):
    help = (
        "Seeds ~90 days of demo bookings with their full history (payments, refunds, reasons) so "
        "the analytics dashboard has data. Run after seed_demo_data. Skips if already seeded."
    )

    @transaction.atomic
    def handle(self, *args, **options):
        offerings = list(
            CentreTest.objects.filter(is_active=True).select_related("centre__lab", "test")
        )
        if not offerings:
            raise CommandError("No catalog found. Run `seed_demo_data` first.")

        patients = [_patient(*details) for details in DEMO_PATIENTS]
        if Booking.objects.filter(client__in=patients).exists():
            self.stdout.write("Demo bookings already exist; nothing to do.")
            return

        random.seed(7)
        self.now = timezone.now()
        self.staff = {
            u.centre_id: u for u in User.objects.filter(role=User.Role.CENTRE, centre__isnull=False)
        }
        self.slots = _SlotBook()
        plans = self._history(offerings, patients) + self._demo_client(offerings)
        count = self._create(plans)
        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {count} demo bookings over {HISTORY_DAYS} days "
                f"({len(patients)} demo patients, password: {DEMO_PASSWORD})."
            )
        )

    def _history(self, offerings, patients):
        by_centre = {}
        for offering in offerings:
            by_centre.setdefault(offering.centre, []).append(offering)

        plans = []
        for centre, centre_offerings in by_centre.items():
            daily_max = DAILY_MAX["demo_lab" if centre.lab.name == DEMO_LAB_NAME else "other"]
            for days_ago in range(HISTORY_DAYS, -1, -1):
                for _ in range(random.randint(0, daily_max)):
                    created_at = self.now - timedelta(days=days_ago, hours=random.uniform(0, 12))
                    day = (created_at + timedelta(days=random.randint(1, 5))).astimezone(LOCAL_TZ)
                    appointment_at = self.slots.take(centre, day.date())
                    if appointment_at is None:
                        continue
                    outcomes = PAST_OUTCOMES if appointment_at < self.now else UPCOMING_OUTCOMES
                    outcome = random.choices(list(outcomes), weights=outcomes.values())[0]
                    if outcome == S.PENDING:
                        # Unpaid holds expire after 30 minutes, so only recent ones are pending.
                        created_at = self.now - timedelta(minutes=random.randint(1, 20))
                    offering = random.choice(centre_offerings)
                    patient = random.choice(patients)
                    walk_in = random.random() < WALK_IN_RATE
                    plans.append((offering, patient, walk_in, created_at, appointment_at, outcome))
        return plans

    def _demo_client(self, offerings):
        client = User.objects.filter(email=DEMO_CLIENT[0]).first()
        if client is None:
            return []
        _patient(*DEMO_CLIENT)
        plans = []
        for days_from_now, outcome in DEMO_CLIENT_BOOKINGS:
            offering = random.choice(offerings)
            day = (self.now + timedelta(days=days_from_now)).astimezone(LOCAL_TZ).date()
            appointment_at = self.slots.take(offering.centre, day)
            if appointment_at is None:
                continue
            if outcome == S.PENDING:
                created_at = self.now - timedelta(minutes=5)
            else:
                created_at = min(appointment_at, self.now) - timedelta(days=random.randint(1, 4))
            plans.append((offering, client, False, created_at, appointment_at, outcome))
        return plans

    def _create(self, plans):
        bookings, stories = [], []
        for offering, client, walk_in, created_at, appointment_at, outcome in plans:
            staff = self.staff.get(offering.centre_id)
            if walk_in:
                booker = (BookingEvent.ActorRole.CENTRE, staff)
            else:
                booker = (BookingEvent.ActorRole.CLIENT, client)
            story = tell(
                outcome,
                amount=offering.price,
                created_at=created_at,
                appointment_at=appointment_at,
                booker=booker,
                staff=staff,
                fee_percent=offering.centre.lab.transaction_fee_percent,
                now=self.now,
            )
            bookings.append(
                Booking(
                    client=client,
                    centre_test=offering,
                    appointment_at=appointment_at,
                    amount=offering.price,
                    status=story.status,
                )
            )
            stories.append((story, created_at))

        Booking.objects.bulk_create(bookings)
        events, payments = [], []
        for booking, (story, created_at) in zip(bookings, stories):
            booking.created_at, booking.updated_at = created_at, story.updated_at
            for status, at, role, actor, note in story.events:
                events.append(
                    BookingEvent(
                        booking=booking,
                        status=status,
                        actor=actor,
                        actor_role=role,
                        note=note,
                        created_at=at,
                    )
                )
            if story.payment is not None:
                story.payment.booking = booking
                story.payment.created_at = created_at + timedelta(minutes=1)
                story.payment.updated_at = story.updated_at
                payments.append(story.payment)
        # auto_now_add/auto_now overwrite timestamps on insert; bulk_update writes the attribute
        # values as-is, which backdates the history.
        Booking.objects.bulk_update(bookings, ["created_at", "updated_at"])
        _backdated_bulk_create(BookingEvent, events, ["created_at"])
        _backdated_bulk_create(Payment, payments, ["created_at", "updated_at"])
        return len(bookings)


class _SlotBook:
    """Hands out appointment slots within each centre's schedule without exceeding capacity."""

    def __init__(self):
        self.rules = {}
        self.taken = Counter()

    def take(self, centre, day):
        if centre.id not in self.rules:
            self.rules[centre.id] = list(centre.slot_rules.all())
        day_rules, _source = rules_for_day(self.rules[centre.id], day)
        open_slots = []
        for rule in day_rules:
            for start in slot_times(rule):
                slot = datetime.combine(day, start, LOCAL_TZ)
                if self.taken[(centre.id, slot)] < rule.capacity:
                    open_slots.append(slot)
        if not open_slots:
            return None
        slot = random.choice(open_slots)
        self.taken[(centre.id, slot)] += 1
        return slot


def _patient(email, first_name, last_name, phone, date_of_birth, gender):
    user, created = User.objects.get_or_create(email=email, defaults={"role": User.Role.CLIENT})
    if created:
        user.set_password(DEMO_PASSWORD)
    if not user.first_name:
        user.first_name, user.last_name = first_name, last_name
        user.phone, user.date_of_birth, user.gender = phone, date_of_birth, gender
    user.save()
    return user


def _backdated_bulk_create(model, objects, fields):
    """bulk_create keeping the objects' own timestamps, which auto_now(_add) would overwrite."""
    stamps = [[getattr(obj, f) for f in fields] for obj in objects]
    created = model.objects.bulk_create(objects)
    for obj, values in zip(created, stamps):
        for f, value in zip(fields, values):
            setattr(obj, f, value)
    model.objects.bulk_update(created, fields)
