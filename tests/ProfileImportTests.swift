import Foundation

@main
struct ImportChecks {
    static func main() throws {
        let current: [String: Any] = ["personal": ["city":"Existing", "email":"keep@example.com"], "saved_answers":[["question":"Q", "answer":"A"]], "resume_path":"keep.pdf"]
        let data = Data(#"{"personal":{"city":"Example City","postal_code":"123456","email":""},"application_source":"LinkedIn"}"#.utf8)
        let merged = try ProfileImport.merge(data, into: current)
        let personal = merged["personal"] as! [String:String]
        assert(personal["city"] == "Example City" && personal["email"] == "keep@example.com")
        assert(merged["application_source"] as? String == "LinkedIn")
        assert(merged["resume_path"] as? String == "keep.pdf")
        assert((merged["saved_answers"] as? [[String:String]])?.first?["answer"] == "A")
        for text in [#"{"personal":{"postal_code":123456}}"#, #"{"personal":{"unknown":"x"}}"#, #"{"personal":{"linkedin":"not a url"}}"#] {
            do { _ = try ProfileImport.merge(Data(text.utf8), into: current); fatalError("Accepted invalid update") } catch {}
        }
        print("PASS profile import validation and merge preservation")
    }
}
