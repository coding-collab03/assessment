import { useState } from 'react'
import './App.css'

function App() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");

 async function handleSubmit(e) {
  e.preventDefault();

  console.log("Submitting form...");

  const response = await fetch("http://localhost:3001/submit-lead", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name, email, company })
  });

  console.log("Response received", response);

  const data = await response.json();
  console.log("DATA:", data);
}

  return (
    <div style={{ padding: "40px", fontFamily: "Arial" }}>
      <h1>Lead Intake Form</h1>

      <form onSubmit={handleSubmit}>
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ display: "block", margin: "10px 0", padding: "8px" }}
        />

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ display: "block", margin: "10px 0", padding: "8px" }}
        />

        <input
          placeholder="Company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          style={{ display: "block", margin: "10px 0", padding: "8px" }}
        />

        <button type="submit">Submit</button>
      </form>
    </div>
  );
}
export default App;