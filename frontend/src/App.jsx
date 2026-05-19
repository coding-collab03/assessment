import { useState } from "react";
import "./App.css";

function App() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    console.log("Submitting form...");

    try {
      const response = await fetch(
        "http://localhost:3001/submit-lead",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            email,
            company,
            website,
          }),
        }
      );

      console.log("Response received", response);

      const data = await response.json();

      console.log("DATA:", data);

      alert(data.message || "Submitted successfully");
    } catch (err) {
      console.error("Submission failed:", err);

      alert("Submission failed");
    }
  }

  return (
    <div
      style={{
        padding: "40px",
        fontFamily: "Arial",
        maxWidth: "500px",
        margin: "0 auto",
      }}
    >
      <h1>Lead Intake Form</h1>

      <form onSubmit={handleSubmit}>
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            display: "block",
            width: "100%",
            margin: "10px 0",
            padding: "10px",
          }}
          required
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            display: "block",
            width: "100%",
            margin: "10px 0",
            padding: "10px",
          }}
          required
        />

        <input
          placeholder="Company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          style={{
            display: "block",
            width: "100%",
            margin: "10px 0",
            padding: "10px",
          }}
          required
        />

        <input
          placeholder="Company Website (https://...)"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          style={{
            display: "block",
            width: "100%",
            margin: "10px 0",
            padding: "10px",
          }}
          required
        />

        <button
          type="submit"
          style={{
            marginTop: "10px",
            padding: "10px 20px",
            cursor: "pointer",
          }}
        >
          Submit
        </button>
      </form>
    </div>
  );
}

export default App;