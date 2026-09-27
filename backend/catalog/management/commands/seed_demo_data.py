import random

from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import User
from catalog.models import Centre, CentreTest, Lab, Test
from scheduling.services import create_default_schedule

LABS = [
    {
        "name": "Apollo Diagnostics",
        "location": "Delhi",
        "fee_percent": 5,
        "centres": ["Connaught Place", "Karol Bagh", "Dwarka"],
    },
    {
        "name": "Metro Health Labs",
        "location": "Mumbai",
        "fee_percent": 8,
        "centres": ["Andheri", "Bandra", "Powai"],
    },
    {
        "name": "CarePlus Diagnostics",
        "location": "Bangalore",
        "fee_percent": 5,
        "centres": ["Indiranagar", "Koramangala", "Whitefield"],
    },
    {
        "name": "Wellness Path Labs",
        "location": "Hyderabad",
        "fee_percent": 10,
        "centres": ["Banjara Hills", "Gachibowli", "Madhapur"],
    },
    {
        "name": "MediCore Labs",
        "location": "Chennai",
        "fee_percent": 3,
        "centres": ["T Nagar", "Anna Nagar", "Velachery"],
    },
    {
        "name": "VitalCheck Diagnostics",
        "location": "Pune",
        "fee_percent": 6,
        "centres": ["Kothrud", "Viman Nagar", "Hinjewadi"],
    },
]

# (name, description, base price in INR)
TESTS = [
    ("Complete Blood Count (CBC)", "Measures red cells, white cells, and platelets.", 350),
    ("Lipid Profile", "Cholesterol and triglyceride levels for heart health.", 600),
    ("Liver Function Test (LFT)", "Assesses liver enzymes and bilirubin.", 700),
    ("Kidney Function Test (KFT)", "Assesses creatinine, urea, and electrolytes.", 650),
    ("Thyroid Profile (T3 T4 TSH)", "Evaluates thyroid hormone levels.", 500),
    ("HbA1c", "Average blood sugar levels over the past 3 months.", 450),
    ("Fasting Blood Glucose", "Blood sugar level measured after fasting.", 150),
    ("Vitamin D (25-OH)", "Measures vitamin D levels in the blood.", 1400),
    ("Vitamin B12", "Measures vitamin B12 levels in the blood.", 900),
    ("Urine Routine & Microscopy", "General urine examination.", 200),
    ("ECG", "Electrocardiogram to record heart electrical activity.", 300),
    ("Chest X-Ray", "Imaging of the lungs and chest cavity.", 400),
    ("Dengue Panel (NS1, IgG, IgM)", "Screens for dengue infection markers.", 1200),
    ("Widal Test", "Screens for typhoid fever.", 250),
    ("Iron Studies", "Measures serum iron, ferritin, and TIBC.", 800),
    ("CRP (C-Reactive Protein)", "Marker of inflammation in the body.", 500),
    ("ESR", "Erythrocyte sedimentation rate, an inflammation marker.", 200),
    ("Blood Grouping & Rh Typing", "Determines ABO blood group and Rh factor.", 150),
    ("COVID-19 RT-PCR", "Molecular test for active COVID-19 infection.", 700),
    ("Full Body Checkup Package", "Comprehensive panel covering major organ systems.", 3500),
]

TESTS_PER_CENTRE_RANGE = (12, 18)
PRICE_VARIANCE = 0.15
INACTIVE_RATE = 0.1

# Demo logins for trying the role/permission matrix. Documented in the README; dev data only.
DEMO_PASSWORD = "EveDemo@2026"
DEMO_LAB_NAME = "Apollo Diagnostics"
DEMO_CENTRE_NAME = "Apollo Diagnostics - Connaught Place"
DEMO_USERS = [
    ("client@demo.eve", User.Role.CLIENT),
    ("lab@demo.eve", User.Role.LAB),
    ("centre@demo.eve", User.Role.CENTRE),
]


class Command(BaseCommand):
    help = "Seeds demo Labs, Centres, Tests, CentreTest pricing and demo logins (idempotent)."

    @transaction.atomic
    def handle(self, *args, **options):
        random.seed(42)

        tests = self._seed_tests()
        centres = self._seed_labs_and_centres()
        created, updated = self._seed_centre_tests(centres, tests)
        self._seed_demo_users()

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {len(LABS)} labs, {len(centres)} centres, {len(tests)} tests, "
                f"{created} new centre-test prices ({updated} updated), "
                f"{len(DEMO_USERS)} demo logins (password: {DEMO_PASSWORD})."
            )
        )

    def _seed_demo_users(self):
        lab = Lab.objects.get(name=DEMO_LAB_NAME)
        centre = Centre.objects.get(name=DEMO_CENTRE_NAME)
        affiliations = {
            User.Role.CLIENT: {"lab": None, "centre": None},
            User.Role.LAB: {"lab": lab, "centre": None},
            User.Role.CENTRE: {"lab": None, "centre": centre},
        }
        for email, role in DEMO_USERS:
            user, _ = User.objects.update_or_create(
                email=email, defaults={"role": role, **affiliations[role]}
            )
            user.set_password(DEMO_PASSWORD)
            user.save(update_fields=["password"])

    def _seed_tests(self):
        tests = []
        for name, description, _price in TESTS:
            test, _ = Test.objects.get_or_create(name=name, defaults={"description": description})
            tests.append(test)
        return tests

    def _seed_labs_and_centres(self):
        centres = []
        for lab_data in LABS:
            # The fee is only set when the lab is created, so a lab admin's own change survives
            # re-running the seed.
            lab, _ = Lab.objects.get_or_create(
                name=lab_data["name"],
                defaults={
                    "location": lab_data["location"],
                    "transaction_fee_percent": lab_data["fee_percent"],
                },
            )
            for locality in lab_data["centres"]:
                centre, _ = Centre.objects.get_or_create(
                    lab=lab,
                    name=f"{lab.name} - {locality}",
                    defaults={"location": f"{locality}, {lab_data['location']}"},
                )
                create_default_schedule(centre)
                centres.append(centre)
        return centres

    def _seed_centre_tests(self, centres, tests):
        base_prices = {name: price for name, _description, price in TESTS}
        created = 0
        updated = 0
        for centre in centres:
            count = random.randint(*TESTS_PER_CENTRE_RANGE)
            for test in random.sample(tests, count):
                base_price = base_prices[test.name]
                variance = random.uniform(-PRICE_VARIANCE, PRICE_VARIANCE)
                price = round(base_price * (1 + variance), 2)
                is_active = random.random() > INACTIVE_RATE
                _, was_created = CentreTest.objects.update_or_create(
                    centre=centre,
                    test=test,
                    defaults={"price": price, "is_active": is_active},
                )
                if was_created:
                    created += 1
                else:
                    updated += 1
        return created, updated
