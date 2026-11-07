# Profile format

Use `config/profile.example.json` for a complete blank profile. Edit the native app's live profile to populate professional summary, skills, and saved answers.

For **Import profile update…**, use this smaller JSON format:

```json
{
  "personal": {
    "first_name": "",
    "last_name": "",
    "full_name": "",
    "email": "",
    "phone": "",
    "linkedin": "",
    "address": "",
    "address_line2": "",
    "city": "",
    "state": "",
    "postal_code": "",
    "country": "",
    "country_code": ""
  },
  "application_source": "LinkedIn"
}
```

Use `address` for street/address line 1, keep postal codes as strings, and use complete HTTPS URLs. `country_code` uses the two-letter code expected by the form. Import merges non-empty values and preserves blank or omitted values. Your CV, professional information, and saved answers remain unchanged. A local backup is saved before each import. **Export profile update…** creates a reusable file with current contact details.

For an exact answer, use **Save question answer…**, or edit the full profile:

```json
"saved_answers": [
  {"question": "Where did you hear about us?", "answer": "LinkedIn"}
]
```

Do not infer work authorization or salary from a CV. Enter those answers yourself. Existing values on webpages are preserved; clear a field manually before replacing it with a new saved value.
