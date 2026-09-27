from accounts.models import User


def can_manage_centre(user, centre):
    """LAB users manage every centre of their own lab; CENTRE users manage only their own."""
    if not user.is_authenticated:
        return False
    if user.role == User.Role.LAB:
        return user.lab_id is not None and centre.lab_id == user.lab_id
    if user.role == User.Role.CENTRE:
        return user.centre_id is not None and centre.id == user.centre_id
    return False


def is_lab_of(user, centre):
    """Only the owning lab sets prices, adds offerings and edits centre details."""
    return (
        user.is_authenticated
        and user.role == User.Role.LAB
        and user.lab_id is not None
        and centre.lab_id == user.lab_id
    )
