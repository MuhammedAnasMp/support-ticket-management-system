from django.db import transaction
from django.core.exceptions import ValidationError

def get_value_from_path(obj, path):
    """
    Recursively extracts the value from the object given a nested path.
    e.g. 'store.name', 'created_by.username', 'allocations.status', 'attachments'.
    
    If path points to ManyToMany or reverse ForeignKey:
        - Return the related manager.
    """
    if not path:
        return obj
    parts = path.split('.')
    return _get_value_from_path_parts(obj, parts)

def _get_value_from_path_parts(obj, parts):
    if obj is None:
        return None
    if not parts:
        return obj
        
    current_part = parts[0]
    remaining_parts = parts[1:]
    
    from django.db.models import Manager
    from django.db.models.query import QuerySet
    
    # If the object is a manager or queryset, evaluate subsequent parts on all items
    if isinstance(obj, (Manager, QuerySet)):
        results = []
        for item in obj.all():
            val = _get_value_from_path_parts(item, parts)
            if isinstance(val, list):
                results.extend(val)
            else:
                results.append(val)
        return results
        
    try:
        if isinstance(obj, dict):
            val = obj.get(current_part)
        else:
            val = getattr(obj, current_part)
    except AttributeError:
        return None
        
    return _get_value_from_path_parts(val, remaining_parts)

def compare_values(obj_value, rule_value):
    """
    Normalizes types and checks if obj_value matches rule_value.
    - If obj_value is an iterable/manager (excluding strings/dicts), checks if rule_value is in it.
    - Otherwise compares string representation.
    """
    rule_str = str(rule_value) if rule_value is not None else ""
    
    from django.db.models import Manager
    from django.db.models.query import QuerySet
    if isinstance(obj_value, (Manager, QuerySet)):
        obj_value = list(obj_value.all())
        
    if isinstance(obj_value, (list, tuple, set)):
        return any(str(item) == rule_str for item in obj_value)
        
    return str(obj_value) == rule_str

def set_value_on_path(obj, path, value):
    """
    Sets a value on an object given a nested or flat path.
    If the path is flat, e.g. 'priority':
        - Check if the field is a ForeignKey/relation. If so, query/resolve it.
        - Otherwise, set the attribute directly.
    If path is nested, e.g. 'store.name', navigate to the parent object and set it there.
    """
    if not path:
        return
        
    parts = path.split('.')
    parent = obj
    for part in parts[:-1]:
        parent = getattr(parent, part, None)
        if parent is None:
            return
            
    field_name = parts[-1]
    
    # Check if field is a relation (e.g. ForeignKey) on parent
    from django.db.models import fields
    try:
        model_field = parent._meta.get_field(field_name)
    except Exception:
        model_field = None
        
    if model_field and model_field.is_relation:
        # Resolve the related model
        related_model = model_field.related_model
        
        # Try to find a matching object
        related_obj = None
        if value:
            # 1. Try finding by primary key (ID)
            try:
                related_obj = related_model.objects.get(pk=value)
            except (related_model.DoesNotExist, ValueError):
                # 2. Try finding by name field (e.g., status_name, priority_name, username, etc.)
                name_fields = [f.name for f in related_model._meta.get_fields() if isinstance(f, (fields.CharField, fields.TextField))]
                for name_field in name_fields:
                    try:
                        related_obj = related_model.objects.get(**{name_field: value})
                        break
                    except (related_model.DoesNotExist, ValueError, TypeError):
                        continue
        setattr(parent, field_name, related_obj)
    else:
        # Standard field: set type appropriately
        if isinstance(model_field, fields.BooleanField):
            if str(value).lower() in ('true', '1', 'yes'):
                value = True
            elif str(value).lower() in ('false', '0', 'no'):
                value = False
        setattr(parent, field_name, value)

def change_status(obj, new_status, changed_by=None, remarks=None):
    """
    Applies the active status change rules for transitioning from obj.status to new_status.
    Runs delete rules and then check rules.
    If all checks pass, updates status and saves obj.
    """
    current_status = obj.status
    if not current_status:
        # No current status, just save
        obj.status = new_status
        if changed_by:
            obj._changed_by = changed_by
        if remarks:
            obj._remarks = remarks
        obj.save()
        return

    from apps.maintenance.models import StatusChangeRule, Status
    
    # Resolve new_status if it's a PK or status name
    if not isinstance(new_status, Status):
        try:
            new_status = Status.objects.get(pk=new_status)
        except (Status.DoesNotExist, ValueError):
            new_status = Status.objects.get(status_name=new_status)
        
    rules = StatusChangeRule.objects.filter(
        from_status=current_status,
        to_status=new_status,
        is_active=True
    )
    
    with transaction.atomic():
        # 1. Run delete rules
        deleted_warnings = []
        for rule in rules.filter(mode="delete"):
            related_val = get_value_from_path(obj, rule.path)
            from django.db.models import Manager
            from django.db.models.query import QuerySet
            deleted_any = False
            if isinstance(related_val, (Manager, QuerySet)):
                if related_val.exists():
                    related_val.all().delete()
                    deleted_any = True
            elif hasattr(related_val, 'all') and callable(getattr(related_val, 'all')):
                if related_val.all().exists():
                    related_val.all().delete()
                    deleted_any = True
            elif hasattr(related_val, 'delete') and callable(getattr(related_val, 'delete')):
                if related_val:
                    related_val.delete()
                    deleted_any = True
            if deleted_any and rule.message:
                deleted_warnings.append(rule.message)
                
        obj._deleted_warnings = deleted_warnings
                
        # 2. Run set rules
        for rule in rules.filter(mode="set"):
            set_value_on_path(obj, rule.path, rule.value)
                
        # 3. Run warning rules
        for rule in rules.filter(mode="warning"):
            val = get_value_from_path(obj, rule.path)
            failed = False
            if rule.value is None or rule.value == "":
                if rule.type == "field":
                    if val is None or val == "":
                        failed = True
                elif rule.type == "related":
                    exists = False
                    if hasattr(val, 'exists') and callable(val.exists):
                        exists = val.exists()
                    elif isinstance(val, (list, tuple, set)):
                        exists = len(val) > 0
                    elif val:
                        exists = True
                    if not exists:
                        failed = True
            else:
                if not compare_values(val, rule.value):
                    failed = True
            if failed and rule.message:
                deleted_warnings.append(rule.message)

        # 4. Run check rules

        for rule in rules.filter(mode="check"):
            val = get_value_from_path(obj, rule.path)
            
            # Check if rule.value is empty/null
            if rule.value is None or rule.value == "":
                if rule.type == "field":
                    if val is None or val == "":
                        raise ValidationError(rule.message)
                elif rule.type == "related":
                    exists = False
                    if hasattr(val, 'exists') and callable(val.exists):
                        exists = val.exists()
                    elif isinstance(val, (list, tuple, set)):
                        exists = len(val) > 0
                    elif val:
                        exists = True
                    if not exists:
                        raise ValidationError(rule.message)
            else:
                # Compare the object value with rule.value
                if not compare_values(val, rule.value):
                    raise ValidationError(rule.message)
                    
        # Update status and save
        obj._bypass_status_rule = True
        try:
            obj.status = new_status
            if new_status.status_name.lower() == 'in progress':
                if not obj.approved_by and changed_by:
                    obj.approved_by = changed_by
                    from django.utils import timezone
                    obj.approved_date = timezone.now()
            elif new_status.status_name.lower() == 'rejected':
                if not obj.rejected_by and changed_by:
                    obj.rejected_by = changed_by
                    from django.utils import timezone
                    obj.rejected_date = timezone.now()
            if changed_by:
                obj._changed_by = changed_by
            if remarks:
                obj._remarks = remarks
            obj.save()
        finally:
            obj._bypass_status_rule = False


def generate_work_order_no(store=None):
    """
    Generates a unique work order number for a ticket.
    If store has a short_code:
        Format: [short_code]-[DDMMYY]-[hhmmA/P] (e.g. WHD-250623-1026A)
        If repeating:
            Add seconds: [short_code]-[DDMMYY]-[hhmmssA/P] (e.g. WHD-250623-102645A)
            If still colliding: append suffix (-1, -2, etc.) to guarantee uniqueness.
    Else (no short_code):
        Fall back to: WO-{timestamp}-{uuid}
    """
    import uuid
    import time
    from datetime import datetime
    from django.utils import timezone

    store_obj = store
    if isinstance(store, (int, str)):
        from apps.stores.models import Store
        store_obj = Store.objects.filter(pk=store).first()

    if store_obj and getattr(store_obj, 'short_code', None) and str(store_obj.short_code).strip():
        short_code = str(store_obj.short_code).strip().upper()
        now = timezone.localtime(timezone.now()) if timezone.is_aware(timezone.now()) else datetime.now()

        date_str = now.strftime("%d%m%y")
        am_pm = now.strftime("%p")[0].upper()  # 'A' for AM, 'P' for PM
        time_no_sec = f"{now.strftime('%I%M')}{am_pm}"  # hhmmA/P, e.g. 1026A

        candidate = f"{short_code}-{date_str}-{time_no_sec}"

        from apps.maintenance.models import Ticket
        if not Ticket.objects.filter(work_order_no=candidate).exists():
            return candidate

        # If work order number is repeating, add seconds
        time_with_sec = f"{now.strftime('%I%M%S')}{am_pm}"  # hhmmssA/P, e.g. 102645A
        candidate_sec = f"{short_code}-{date_str}-{time_with_sec}"

        if not Ticket.objects.filter(work_order_no=candidate_sec).exists():
            return candidate_sec

        # If still repeating (same second collision), append suffix
        counter = 1
        while True:
            candidate_suffix = f"{short_code}-{date_str}-{time_with_sec}-{counter}"
            if not Ticket.objects.filter(work_order_no=candidate_suffix).exists():
                return candidate_suffix
            counter += 1

    return f"WO-{int(time.time())}-{uuid.uuid4().hex[:4].upper()}"

