import React, { useState } from "react";

const languages = [
    { code: "en", name: "English" },
    { code: "ml", name: "Malayalam" },
    { code: "hi", name: "Hindi" },
    { code: "ta", name: "Tamil" },
];

const Test: React.FC = () => {
    const [language, setLanguage] = useState("en");
    const [input, setInput] = useState("");
    const [result, setResult] = useState("");

    const transliterate = async (text: string, lang: string) => {
        if (!text.trim()) {
            setResult("");
            return;
        }

        // English: No transliteration
        if (lang === "en") {
            setResult(text);
            return;
        }

        try {
            const response = await fetch(
                `https://inputtools.google.com/request?itc=${lang}-t-i0-und&num=1&text=${encodeURIComponent(
                    text
                )}`
            );

            const data = await response.json();

            if (data[0] === "SUCCESS") {
                setResult(data[1][0][1][0]);
            } else {
                setResult("");
            }
        } catch (error) {
            console.error("Transliteration Error:", error);
            setResult("");
        }
    };

    const handleInputChange = async (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const value = e.target.value;
        setInput(value);
        await transliterate(value, language);
    };

    const handleLanguageChange = async (
        e: React.ChangeEvent<HTMLSelectElement>
    ) => {
        const lang = e.target.value;
        setLanguage(lang);

        if (input) {
            await transliterate(input, lang);
        } else {
            setResult("");
        }
    };

    return (
        <div
            style={{
                maxWidth: "600px",
                margin: "40px auto",
                padding: "20px",
                fontFamily: "Arial, sans-serif",
            }}
        >
            <h2>Manglish / English Transliteration</h2>

            <div style={{ marginBottom: "15px" }}>
                <label style={{ fontWeight: "bold" }}>Language</label>
                <select
                    value={language}
                    onChange={handleLanguageChange}
                    style={{
                        width: "100%",
                        padding: "10px",
                        marginTop: "5px",
                        fontSize: "16px",
                    }}
                >
                    {languages.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                            {lang.name}
                        </option>
                    ))}
                </select>
            </div>

            <div style={{ marginBottom: "15px" }}>
                <label style={{ fontWeight: "bold" }}>Type Here</label>
                <input
                    type="text"
                    value={input}
                    onChange={handleInputChange}
                    placeholder="Type using English letters..."
                    style={{
                        width: "100%",
                        padding: "10px",
                        marginTop: "5px",
                        fontSize: "18px",
                    }}
                />
            </div>

            <div>
                <label style={{ fontWeight: "bold" }}>Output</label>
                <input
                    type="text"
                    value={result}
                    readOnly
                    style={{
                        width: "100%",
                        padding: "10px",
                        marginTop: "5px",
                        fontSize: "18px",
                        background: "#f5f5f5",
                    }}
                />
            </div>
        </div>
    );
};

export default Test;
