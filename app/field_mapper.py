"""Deterministic mapping for the Windows preview table."""
import re

KEYWORD_MAP = {
    "personal.first_name": ["first name", "firstname", "given name"],
    "personal.last_name": ["last name", "surname", "lastname", "family name"],
    "personal.full_name": ["full name", "your name", "name"],
    "personal.email": ["email", "e-mail", "email address"],
    "personal.phone": ["phone", "mobile", "telephone", "cell", "contact number"],
    "personal.location": ["location", "city", "address", "current location", "where are you located"],
    "personal.linkedin": ["linked in", "linkedin", "linkedin url", "linkedin profile"],
    "personal.github": ["github", "github url", "github profile"],
    "personal.portfolio": ["portfolio", "website", "personal website", "personal url"],
    "professional.current_title": ["current title", "job title", "position", "role"],
    "professional.years_experience": ["years of experience", "years experience", "total experience", "experience"],
    "professional.notice_period": ["notice period"],
    "professional.current_company": ["current company", "current employer", "employer"],
    "professional.expected_salary": ["expected salary", "salary expectation", "salary", "ctc"],
    "professional.skills": ["skills", "technical skills", "tech stack"],
    "work_authorization.requires_sponsorship": ["sponsorship", "visa sponsorship", "require sponsorship"],
    "work_authorization.authorized_to_work": ["authorized to work", "work authorization", "eligible to work"],
    "custom_answers.why_this_company": ["why this company", "why do you want to work", "why us"],
    "custom_answers.why_this_role": ["why this role", "why this position", "why are you applying"],
}


def _field_label(field):
    return (field.get("label") or field.get("placeholder") or field.get("name") or "unknown field").strip()


def map_fields(fields, profile):
    mapping = []
    used_keys = set()

    for field in fields:
        label = re.sub(r"([a-z])([A-Z])", r"\1 \2", _field_label(field)).lower()
        best_key = None
        best_score = 0

        for key, keywords in KEYWORD_MAP.items():
            if key in used_keys:
                continue
            for kw in keywords:
                if kw in label:
                    score = len(kw)
                    if score > best_score:
                        best_score = score
                        best_key = key

        entry = {
            "label": field.get("label") or field.get("placeholder") or "unknown",
            "selector": field["selector"],
            "type": field.get("type", "text"),
            "profile_key": best_key,
            "value": None,
        }

        if best_key:
            used_keys.add(best_key)
            entry["value"] = _resolve_value(profile, best_key)

        mapping.append(entry)

    return mapping


def _resolve_value(profile, dotted_key):
    cur = profile
    for part in dotted_key.split("."):
        if isinstance(cur, dict) and part in cur:
            cur = cur[part]
        else:
            return None
    if isinstance(cur, list):
        return ", ".join(str(x) for x in cur)
    return cur if cur is not None else None
