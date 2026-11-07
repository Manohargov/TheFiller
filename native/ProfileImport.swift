import Foundation

enum ProfileImport {
    static let fields: Set<String> = ["first_name", "last_name", "full_name", "email", "phone", "linkedin", "github", "portfolio", "address", "address_line2", "city", "state", "postal_code", "country", "country_code", "location"]
    static func merge(_ data: Data, into current: [String: Any]) throws -> [String: Any] {
        guard let input = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              Set(input.keys).isSubset(of: ["personal", "application_source"]), let personal = input["personal"] as? [String: Any], !personal.isEmpty else {
            throw NSError(domain: "Use a JSON object containing a personal object. See the profile update template.", code: 1)
        }
        var result = current
        var existing = current["personal"] as? [String: Any] ?? [:]
        for (key, value) in personal {
            guard fields.contains(key), let text = value as? String, text.count < 2000 else {
                throw NSError(domain: "Unknown field or invalid text value: \(key)", code: 2)
            }
            let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
            if ["linkedin", "github", "portfolio"].contains(key), !clean.isEmpty {
                guard let url = URL(string: clean), ["https", "http"].contains(url.scheme ?? ""), url.host != nil else {
                    throw NSError(domain: "Enter a complete https:// URL for \(key)", code: 3)
                }
            }
            // Empty template values preserve existing details; remove a value using Edit CV profile.
            if !clean.isEmpty { existing[key] = clean }
        }
        if let source = input["application_source"] {
            guard let text = source as? String, text.count < 200 else { throw NSError(domain: "application_source must be text", code: 4) }
            let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
            if !clean.isEmpty { result["application_source"] = clean }
        }
        result["personal"] = existing
        return result
    }
}
