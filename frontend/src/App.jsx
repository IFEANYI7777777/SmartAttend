import { useEffect, useRef, useState } from "react";
import "./App.css";

function App() {
 const [backendMessage, setBackendMessage] = useState("");

  const employees = [
  {
    pin: "1234",
    name: "Ifeanyi Test",
    section: "Sports",
  },
  {
    pin: "5678",
    name: "Jane Doe",
    section: "Kitchen",
  },
  {
    pin: "2468",
    name: "Mike Smith",
    section: "Electronics",
  },
];
useEffect(() => {
  fetch("http://localhost:5000/api/health")
    .then((response) => response.json())
    .then((data) => {
      setBackendMessage(data.message);
    })
    .catch((error) => {
      console.error("Backend connection error:", error);
    });
}, []);

  const videoRef = useRef(null);
const [started, setStarted] = useState(false);
const [employee, setEmployee] = useState(null);
const [pin, setPin] = useState("");
const [error, setError] = useState("");
useEffect(() => {
  if (!started || employee) return;

  let stream;

  const startCamera = async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Camera access denied:", error);
    }
  };

  startCamera();

  return () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  };
}, [started, employee]);

  const simulateFaceScan = () => {
  setEmployee({
    name: "Ifeanyi Test",
    section: "Sports",
    time: new Date().toLocaleTimeString(),
  });
};
const verifyPin = () => {
  const foundEmployee = employees.find(
    (employee) => employee.pin === pin
  );

  if (!foundEmployee) {
    setError("Invalid PIN. Please try again.");
    return;
  }

  setError("");

  setEmployee({
    name: foundEmployee.name,
    section: foundEmployee.section,
    time: new Date().toLocaleTimeString(),
  });
};

  if (started && employee) {
    return (
      <div className="app">
        <header className="header">
          <div className="logo">
            <span className="logo-icon">S</span>
            <span>SmartAttend</span>
          </div>

          <div className="status">
            <span className="status-dot"></span>
            System Online
          </div>
        </header>

        <main className="checkin-page">
          <p className="welcome">ATTENDANCE CONFIRMED</p>

          <h1>Welcome, {employee.name}</h1>

          <div className="employee-card">
            <div className="employee-avatar">
              {employee.name.charAt(0)}
            </div>

            <div className="employee-info">
              <div>
                <span>Employee</span>
                <strong>{employee.name}</strong>
              </div>

              <div>
                <span>Section</span>
                <strong>{employee.section}</strong>
              </div>

              <div>
                <span>Clock-in Time</span>
                <strong>{employee.time}</strong>
              </div>
            </div>
          </div>

          <button
            className="start-button"
            onClick={() => {
              setEmployee(null);
              setStarted(false);
            }}
          >
            Finish
          </button>
        </main>
      </div>
    );
  }

  if (started) {
    return (
      <div className="app">
        <header className="header">
          <div className="logo">
            <span className="logo-icon">S</span>
            <span>SmartAttend</span>
          </div>

          <div className="status">
            <span className="status-dot"></span>
            System Online
          </div>
        </header>

        <main className="checkin-page">
          <p className="welcome">EMPLOYEE CHECK-IN</p>

          <h1>Ready to check in?</h1>

          <p className="description">
            Position your face in front of the camera to begin
            attendance verification.
          </p>

         <div className="camera-box">
  <video
    ref={videoRef}
    autoPlay
    playsInline
    muted
  ></video>
</div>
          <button
            className="start-button"
            onClick={simulateFaceScan}
          >
            Simulate Face Scan
          </button>
          <div className="pin-section">
  <p>Can't be identified? Enter your personal PIN.</p>

  <input
  type="password"
  inputMode="numeric"
  placeholder="Enter 4-digit PIN"
  value={pin}
  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
  maxLength="4"
/>
  <button
    className="start-button"
    onClick={verifyPin}
  >
    Verify PIN
  </button>

  {error && <p className="error-message">{error}</p>}
</div>

          <button
            className="back-button"
            onClick={() => setStarted(false)}
          >
            ← Back
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <span className="logo-icon">S</span>
          <span>SmartAttend</span>
        </div>

        <div className="status">
          <span className="status-dot"></span>
          System Online
        </div>
      </header>

      <main className="main">
      <div className="backend-status">
  {backendMessage && (
    <p>🟢 Backend: {backendMessage}</p>
  )}
</div>
        <section className="hero">
          <p className="welcome">WELCOME TO SMARTATTEND</p>

          <h1>
            Smart attendance.
            <br />
            <span>Simple & secure.</span>
          </h1>

          <p className="description">
            A modern attendance management system designed to make
            employee check-in fast, accurate and effortless.
          </p>

          <button
            className="start-button"
            onClick={() => setStarted(true)}
          >
            Start Attendance
          </button>
        </section>

        <section className="features">
          <div className="feature-card">
            <div className="feature-icon">◉</div>
            <h3>Face Recognition</h3>
            <p>
              Quickly identify employees using facial recognition.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">✓</div>
            <h3>Fast Check-In</h3>
            <p>
              Record employee arrival time accurately in seconds.
            </p>
          </div>

         <div className="feature-card">
  <div className="feature-icon">▣</div>
  <h3>Smart Management</h3>
  <p>
    Managers can monitor attendance across departments.
  </p>
</div>
</section>
</main>
  </div>
  );
}
export default App;