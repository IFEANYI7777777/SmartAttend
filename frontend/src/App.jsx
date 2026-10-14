import { useEffect, useRef, useState } from "react";
import * as faceapi from "@vladmandic/face-api";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const FACE_STORAGE_KEY = "smartattend_face_descriptors";
const WORK_START_MINUTES = 7 * 60;
const GRACE_MINUTES = 15;
const DEVICE_ID = "ENTRANCE-01";

const SECTIONS = [
  "Provision",
  "Kitchen",
  "Biscuits",
  "Baby Food",
  "Toiletries",
  "Gift",
  "Electronics",
  "Boutique",
  "Sports",
  "Makeup",
  "Cosmetics",
  "Bookshop",
  "Frozen",
  "Wine",
  "Fruits",
];

const FACE_CAPTURE_INSTRUCTIONS = [
  "Look straight at the camera.",
  "Turn your face slightly to the left.",
  "Turn your face slightly to the right.",
];

function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLocalTimeString() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getLongDateString() {
  return new Date().toLocaleDateString([], {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getMinutesFromTime(value) {
  if (!value) return null;

  const match = String(value).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3]?.toUpperCase();

  if (period === "PM" && hours < 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

function getStatusLabel(timeString) {
  const minutes = getMinutesFromTime(timeString);

  if (minutes === null) return "Present";

  return minutes > WORK_START_MINUTES + GRACE_MINUTES
    ? "Late"
    : "Present";
}

function escapeCSV(value) {
  const stringValue = String(value ?? "");
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function normalizeDescriptors(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((descriptor) => Array.isArray(descriptor))
    .filter((descriptor) => descriptor.length === 128)
    .map((descriptor) => descriptor.map(Number));
}

function StatusPill({ online, backendConnected }) {
  const ready = online && backendConnected;

  return (
    <div className="status">
      <span
        className={ready ? "status-dot" : "status-dot offline"}
      ></span>
      {ready
        ? "System Online"
        : online
        ? "Backend Offline"
        : "Offline"}
    </div>
  );
}

function App() {
  // =====================================
  // GENERAL STATE
  // =====================================

  const [employees, setEmployees] = useState([]);
  const [backendConnected, setBackendConnected] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [currentTime, setCurrentTime] = useState(
    getLocalTimeString()
  );

  // =====================================
  // FACE RECOGNITION STATE
  // =====================================

  const [faceModelsLoaded, setFaceModelsLoaded] = useState(false);
  const [faceModelError, setFaceModelError] = useState("");
  const [faceScanning, setFaceScanning] = useState(false);
  const [faceMessage, setFaceMessage] = useState("");
  const [faceDescriptors, setFaceDescriptors] = useState({});
  const [lastFaceScore, setLastFaceScore] = useState(null);

  // =====================================
  // CAMERA STATE
  // =====================================

  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraRetryToken, setCameraRetryToken] = useState(0);

  // =====================================
  // EMPLOYEE REGISTRATION
  // =====================================

  const [showRegister, setShowRegister] = useState(false);
  const [employeeName, setEmployeeName] = useState("");
  const [employeeSection, setEmployeeSection] = useState("");
  const [employeePin, setEmployeePin] = useState("");
  const [registerMessage, setRegisterMessage] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);

  // =====================================
  // FACE REGISTRATION
  // =====================================

  const [pendingFaceEmployee, setPendingFaceEmployee] = useState(null);
  const [faceCaptureStep, setFaceCaptureStep] = useState(0);
  const [capturedFaceDescriptors, setCapturedFaceDescriptors] = useState(
    []
  );

  // =====================================
  // ATTENDANCE
  // =====================================

  const [started, setStarted] = useState(false);
  const [employee, setEmployee] = useState(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [checkingIn, setCheckingIn] = useState(false);
  const [attendanceRecorded, setAttendanceRecorded] = useState(false);
  const [attendanceMessage, setAttendanceMessage] = useState("");

  // =====================================
  // DASHBOARD
  // =====================================

  const [showDashboard, setShowDashboard] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [selectedSection, setSelectedSection] = useState("All");
  const [dashboardSearch, setDashboardSearch] = useState("");
  const [dashboardDate, setDashboardDate] =
    useState(getLocalDateString());

  // =====================================
  // EMPLOYEE MANAGEMENT
  // =====================================

  const [showEmployees, setShowEmployees] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");

  // =====================================
  // DOCUMENT TITLE
  // =====================================

  useEffect(() => {
    document.title = "SmartAttend | Attendance Management";
  }, []);

  // =====================================
  // LOAD SAVED FACE DESCRIPTORS
  // =====================================

  useEffect(() => {
    try {
      const saved = localStorage.getItem(FACE_STORAGE_KEY);

      if (!saved) return;

      const parsed = JSON.parse(saved);
      const cleaned = {};

      Object.entries(parsed || {}).forEach(
        ([employeeId, descriptors]) => {
          const normalized = normalizeDescriptors(descriptors);

          if (normalized.length > 0) {
            cleaned[employeeId] = normalized;
          }
        }
      );

      setFaceDescriptors(cleaned);
    } catch (error) {
      console.error(
        "Could not load face descriptors:",
        error
      );
    }
  }, []);

  // =====================================
  // ONLINE/OFFLINE STATUS
  // =====================================

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // =====================================
  // LIVE CLOCK
  // =====================================

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getLocalTimeString());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // =====================================
  // LOAD FACE MODELS
  // =====================================

  useEffect(() => {
    let cancelled = false;

    const loadFaceModels = async () => {
      try {
        setFaceModelError("");
        setFaceModelsLoaded(false);
        setFaceMessage("Loading face recognition...");

        const modelPath = "/models";

        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(modelPath),
          faceapi.nets.faceLandmark68Net.loadFromUri(modelPath),
          faceapi.nets.faceRecognitionNet.loadFromUri(modelPath),
        ]);

        if (cancelled) return;

        setFaceModelsLoaded(true);
        setFaceMessage("Face recognition system ready.");
      } catch (error) {
        if (cancelled) return;

        console.error("Face model loading error:", error);

        setFaceModelError(
          "Could not load face recognition models. Check public/models."
        );

        setFaceMessage("");
      }
    };

    loadFaceModels();

    return () => {
      cancelled = true;
    };
  }, []);

  // =====================================
  // INITIAL BACKEND DATA
  // =====================================

  useEffect(() => {
    checkBackend();
    loadEmployees();
    loadAttendance();
  }, []);

  const checkBackend = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/health`
      );

      if (!response.ok) {
        throw new Error(
          `Backend returned status ${response.status}`
        );
      }

      const data = await response.json();

      console.log(
        "SmartAttend backend connected:",
        data
      );

      setBackendConnected(true);
    } catch (error) {
      console.error(
        "Backend connection error:",
        error
      );

      setBackendConnected(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/employees`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Could not load employees."
        );
      }

      setEmployees(
        Array.isArray(data) ? data : []
      );

      setBackendConnected(true);

      console.log("Employees loaded:", data);
    } catch (error) {
      console.error(
        "Employee loading error:",
        error
      );

      setBackendConnected(false);
    }
  };

  const loadAttendance = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/attendance`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not load attendance records."
        );
      }

      setAttendanceRecords(
        Array.isArray(data) ? data : []
      );

      setBackendConnected(true);

      console.log(
        "Attendance loaded:",
        data
      );
    } catch (error) {
      console.error(
        "Attendance loading error:",
        error
      );

      setBackendConnected(false);
    }
  };

  // =====================================
  // CAMERA CONTROL
  // =====================================

  useEffect(() => {
    const cameraNeeded =
      (started || pendingFaceEmployee) &&
      !employee;

    if (!cameraNeeded) {
      setCameraReady(false);
      return undefined;
    }

    let cancelled = false;

    const startCamera = async () => {
      try {
        setCameraError("");
        setCameraReady(false);

        if (
          !navigator.mediaDevices ||
          !navigator.mediaDevices.getUserMedia
        ) {
          setCameraError(
            "Camera access is not supported by this browser."
          );
          return;
        }

        const stream =
          await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "user",
              width: {
                ideal: 1280,
                min: 640,
              },
              height: {
                ideal: 720,
                min: 480,
              },
            },
            audio: false,
          });

        if (cancelled) {
          stream
            .getTracks()
            .forEach((track) => track.stop());

          return;
        }

        cameraStreamRef.current = stream;

        const video = videoRef.current;

        if (!video) {
          stream
            .getTracks()
            .forEach((track) => track.stop());

          return;
        }

        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;

        await video.play();

        const startTime = Date.now();

        while (
          !cancelled &&
          (video.readyState < 2 ||
            video.videoWidth === 0 ||
            video.videoHeight === 0)
        ) {
          if (Date.now() - startTime > 5000) break;

          await new Promise((resolve) =>
            setTimeout(resolve, 150)
          );
        }

        if (cancelled) return;

        if (
          video.readyState >= 2 &&
          video.videoWidth > 0 &&
          video.videoHeight > 0
        ) {
          setCameraReady(true);
        } else {
          setCameraError(
            "Camera opened but no video frames are available. Please retry the camera."
          );
        }
      } catch (error) {
        console.error(
          "Camera access error:",
          error
        );

        if (cancelled) return;

        let message =
          "Camera could not start. Please allow camera access in your browser.";

        if (error?.name === "NotAllowedError") {
          message =
            "Camera permission was blocked. Allow camera access and click Retry Camera.";
        } else if (error?.name === "NotFoundError") {
          message =
            "No camera was found on this device.";
        } else if (
          error?.name === "NotReadableError"
        ) {
          message =
            "The camera is being used by another application. Close it and retry.";
        }

        setCameraError(message);
      }
    };

    startCamera();

    return () => {
      cancelled = true;

      if (cameraStreamRef.current) {
        cameraStreamRef.current
          .getTracks()
          .forEach((track) => {
            track.stop();
          });

        cameraStreamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [
    started,
    pendingFaceEmployee,
    employee,
    cameraRetryToken,
  ]);

  const retryCamera = () => {
    setCameraError("");
    setCameraReady(false);
    setCameraRetryToken(
      (value) => value + 1
    );
  };

  // =====================================
  // FACE DETECTION HELPER
  // =====================================

  const detectFaceDescriptor = async () => {
    const video = videoRef.current;

    if (!video) return null;

    if (
      video.readyState < 2 ||
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      return null;
    }

    const options =
      new faceapi.TinyFaceDetectorOptions({
        inputSize: 512,
        scoreThreshold: 0.3,
      });

    for (
      let attempt = 0;
      attempt < 5;
      attempt += 1
    ) {
      const detections = await faceapi
        .detectAllFaces(video, options)
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length > 0) {
        detections.sort((a, b) => {
          const aArea =
            (a.detection?.box?.width || 0) *
            (a.detection?.box?.height || 0);

          const bArea =
            (b.detection?.box?.width || 0) *
            (b.detection?.box?.height || 0);

          return bArea - aArea;
        });

        setLastFaceScore(
          detections[0].detection.score
        );

        return detections[0];
      }

      await new Promise((resolve) =>
        setTimeout(resolve, 250)
      );
    }

    return null;
  };

  // =====================================
  // SAVE FACE DESCRIPTORS
  // =====================================

  const saveFaceDescriptors = (
    employeeId,
    descriptors
  ) => {
    const cleaned =
      normalizeDescriptors(descriptors);

    if (cleaned.length === 0) {
      throw new Error(
        "No valid face descriptors were captured."
      );
    }

    try {
      const saved = JSON.parse(
        localStorage.getItem(
          FACE_STORAGE_KEY
        ) || "{}"
      );

      const updated = {
        ...saved,
        [employeeId]: cleaned,
      };

      localStorage.setItem(
        FACE_STORAGE_KEY,
        JSON.stringify(updated)
      );

      setFaceDescriptors(updated);
    } catch (error) {
      console.error(
        "Face descriptor save error:",
        error
      );

      throw new Error(
        "Could not save face registration."
      );
    }
  };

  // =====================================
  // FACE REGISTRATION
  // =====================================

  const startFaceRegistration = (
    selectedEmployee
  ) => {
    setPendingFaceEmployee(
      selectedEmployee
    );

    setFaceCaptureStep(0);
    setCapturedFaceDescriptors([]);
    setFaceMessage(
      FACE_CAPTURE_INSTRUCTIONS[0]
    );
    setCameraError("");
    setError("");
    setLastFaceScore(null);
    setShowEmployees(false);
    setShowRegister(false);
  };

  const captureFaceSample = async () => {
    setError("");

    if (!faceModelsLoaded) {
      setError(
        "Face recognition is still loading. Please wait."
      );
      return;
    }

    if (!cameraReady) {
      setError(
        "Camera is not ready yet. Please wait or retry the camera."
      );
      return;
    }

    if (!pendingFaceEmployee) {
      setError(
        "No employee selected for face registration."
      );
      return;
    }

    setFaceScanning(true);
    setFaceMessage("Scanning face...");

    try {
      const detection =
        await detectFaceDescriptor();

      if (!detection) {
        setError(
          "No face detected. Move closer, face the camera directly, and make sure your face is well lit."
        );

        setFaceMessage(
          FACE_CAPTURE_INSTRUCTIONS[
            faceCaptureStep
          ]
        );

        return;
      }

      const descriptor = Array.from(
        detection.descriptor
      );

      const nextDescriptors = [
        ...capturedFaceDescriptors,
        descriptor,
      ];

      const isLastStep =
        faceCaptureStep ===
        FACE_CAPTURE_INSTRUCTIONS.length - 1;

      if (isLastStep) {
        saveFaceDescriptors(
          pendingFaceEmployee.id,
          nextDescriptors
        );

        setFaceMessage(
          `Face registered successfully for ${pendingFaceEmployee.name}.`
        );

        setError("");
        setPendingFaceEmployee(null);
        setFaceCaptureStep(0);
        setCapturedFaceDescriptors([]);
        setShowEmployees(true);
        setLastFaceScore(null);
      } else {
        const nextStep =
          faceCaptureStep + 1;

        setCapturedFaceDescriptors(
          nextDescriptors
        );

        setFaceCaptureStep(nextStep);

        setFaceMessage(
          FACE_CAPTURE_INSTRUCTIONS[
            nextStep
          ]
        );
      }
    } catch (error) {
      console.error(
        "Face registration error:",
        error
      );

      setError(
        error?.message ||
          "Face registration failed. Please try again."
      );
    } finally {
      setFaceScanning(false);
    }
  };

  const cancelFaceRegistration = () => {
    setPendingFaceEmployee(null);
    setFaceCaptureStep(0);
    setCapturedFaceDescriptors([]);
    setFaceMessage("");
    setError("");
    setLastFaceScore(null);
    setShowEmployees(true);
  };

  // =====================================
  // ATTENDANCE RECORDING
  // =====================================

  const recordAttendance = async (
    targetEmployee,
    method = "face"
  ) => {
    if (!targetEmployee) return;

    setCheckingIn(true);
    setAttendanceMessage("");
    setError("");

    try {
      const today = getLocalDateString();

      let existingAttendance = [];

      try {
        const attendanceResponse =
          await fetch(
            `${API_BASE}/api/attendance`
          );

        if (attendanceResponse.ok) {
          const existingData =
            await attendanceResponse.json();

          existingAttendance =
            Array.isArray(existingData)
              ? existingData
              : [];
        }
      } catch (loadError) {
        console.warn(
          "Could not pre-check attendance:",
          loadError
        );
      }

      const alreadyCheckedIn =
        existingAttendance.find(
          (record) =>
            record.date === today &&
            (String(record.employeeId) ===
              String(targetEmployee.id) ||
              record.name ===
                targetEmployee.name)
        );

      if (alreadyCheckedIn) {
        setEmployee({
          id: targetEmployee.id,
          name: targetEmployee.name,
          section: targetEmployee.section,
          time:
            alreadyCheckedIn.clockInTime ||
            targetEmployee.time,
        });

        setAttendanceRecorded(true);

        setAttendanceMessage(
          `Already clocked in today at ${
            alreadyCheckedIn.clockInTime ||
            targetEmployee.time
          }.`
        );

        return;
      }

      const response = await fetch(
        `${API_BASE}/api/attendance/check-in`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            employeeId: targetEmployee.id,
            method,
            deviceId: DEVICE_ID,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message ||
            "Could not record attendance."
        );

        return;
      }

      const attendance =
        data.attendance || {};

      setEmployee({
        id: targetEmployee.id,
        name:
          attendance.name ||
          targetEmployee.name,
        section:
          attendance.section ||
          targetEmployee.section,
        time:
          attendance.clockInTime ||
          targetEmployee.time,
      });

      setAttendanceRecorded(true);

      setAttendanceMessage(
        data.message ||
          "Attendance recorded successfully."
      );

      setBackendConnected(true);

      await loadAttendance();
    } catch (error) {
      console.error(
        "Attendance recording error:",
        error
      );

      setError(
        "Could not connect to the attendance server."
      );

      setBackendConnected(false);
    } finally {
      setCheckingIn(false);
    }
  };

  // =====================================
  // FACE RECOGNITION
  // =====================================

  const scanFace = async () => {
    setError("");
    setFaceMessage("");
    setLastFaceScore(null);

    if (!faceModelsLoaded) {
      setError(
        "Face recognition is still loading. Please wait."
      );
      return;
    }

    if (!cameraReady) {
      setError(
        "Camera is not ready. Please wait or click Retry Camera."
      );
      return;
    }

    if (employees.length === 0) {
      setError(
        "No employees are registered yet."
      );
      return;
    }

    const registeredEmployees =
      employees.filter(
        (item) =>
          normalizeDescriptors(
            faceDescriptors[item.id]
          ).length > 0
      );

    if (registeredEmployees.length === 0) {
      setError(
        "No registered faces are available. Open Manage Employees and register a face first."
      );
      return;
    }

    setFaceScanning(true);
    setFaceMessage(
      "Checking your face..."
    );

    try {
      const detection =
        await detectFaceDescriptor();

      if (!detection) {
        setError(
          "No face detected. Move closer to the camera, face it directly, and improve the lighting."
        );

        setFaceMessage("");
        return;
      }

      setFaceMessage(
        "Face detected. Identifying employee..."
      );

      const labeledDescriptors =
        registeredEmployees.map(
          (registeredEmployee) => {
            const descriptors =
              normalizeDescriptors(
                faceDescriptors[
                  registeredEmployee.id
                ]
              );

            return new faceapi.LabeledFaceDescriptors(
              String(
                registeredEmployee.id
              ),
              descriptors.map(
                (descriptor) =>
                  new Float32Array(
                    descriptor
                  )
              )
            );
          }
        );

      const faceMatcher =
        new faceapi.FaceMatcher(
          labeledDescriptors,
          0.62
        );

      const bestMatch =
        faceMatcher.findBestMatch(
          detection.descriptor
        );

      console.log(
        "SmartAttend face match:",
        bestMatch
      );

      if (
        bestMatch.label === "unknown"
      ) {
        setError(
          "Face not recognized. Please try again or use your personal PIN."
        );

        setFaceMessage("");
        return;
      }

      const foundEmployee =
        employees.find(
          (item) =>
            String(item.id) ===
            String(bestMatch.label)
        );

      if (!foundEmployee) {
        setError(
          "The recognized employee could not be found in the employee records."
        );

        setFaceMessage("");
        return;
      }

      setFaceMessage(
        `Recognized ${foundEmployee.name}. Recording attendance...`
      );

      console.log(
        "Employee recognized:",
        foundEmployee
      );

      console.log(
        "Match distance:",
        bestMatch.distance
      );

      await recordAttendance(
        {
          id: foundEmployee.id,
          name: foundEmployee.name,
          section: foundEmployee.section,
          time: getLocalTimeString(),
        },
        "face"
      );
    } catch (error) {
      console.error(
        "Face recognition error:",
        error
      );

      setError(
        "Unable to scan the face. Please try again."
      );

      setFaceMessage("");
    } finally {
      setFaceScanning(false);
    }
  };

  // =====================================
  // PIN CHECK-IN
  // =====================================

  const verifyPin = async () => {
    setError("");

    if (pin.length !== 4) {
      setError(
        "Please enter your 4-digit PIN."
      );
      return;
    }

    const foundEmployee =
      employees.find(
        (item) =>
          String(item.pin) ===
          String(pin)
      );

    if (!foundEmployee) {
      setError(
        "Invalid PIN. Please try again."
      );
      return;
    }

    setPin("");

    await recordAttendance(
      {
        id: foundEmployee.id,
        name: foundEmployee.name,
        section: foundEmployee.section,
        time: getLocalTimeString(),
      },
      "pin"
    );
  };

  // =====================================
  // EMPLOYEE REGISTRATION
  // =====================================

  const registerEmployee = async () => {
    setRegisterMessage("");
    setError("");

    if (employeeName.trim().length < 3) {
      setRegisterMessage(
        "Employee name must be at least 3 characters."
      );
      return;
    }

    if (!employeeSection) {
      setRegisterMessage(
        "Please select an employee section."
      );
      return;
    }

    if (!/^\d{4}$/.test(employeePin)) {
      setRegisterMessage(
        "PIN must be exactly 4 digits."
      );
      return;
    }

    if (
      employees.some(
        (item) =>
          String(item.pin) ===
          String(employeePin)
      )
    ) {
      setRegisterMessage(
        "That PIN is already assigned to another employee."
      );
      return;
    }

    setRegisterLoading(true);

    try {
      const response = await fetch(
        `${API_BASE}/api/employees`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            name: employeeName.trim(),
            section: employeeSection,
            pin: employeePin,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        setRegisterMessage(
          data.message ||
            "Employee registration failed."
        );

        return;
      }

      if (!data.employee) {
        setRegisterMessage(
          "Employee was created but the server returned no employee record."
        );

        return;
      }

      setEmployees((current) => [
        ...current,
        data.employee,
      ]);

      setEmployeeName("");
      setEmployeeSection("");
      setEmployeePin("");

      setBackendConnected(true);

      setRegisterMessage(
        `${data.employee.name} registered successfully. Now registering face...`
      );

      setPendingFaceEmployee(
        data.employee
      );

      setFaceCaptureStep(0);
      setCapturedFaceDescriptors([]);
      setFaceMessage(
        FACE_CAPTURE_INSTRUCTIONS[0]
      );

      setCameraError("");
      setLastFaceScore(null);
      setShowRegister(false);
      setShowEmployees(false);
    } catch (error) {
      console.error(
        "Employee registration error:",
        error
      );

      setRegisterMessage(
        "Could not connect to the backend."
      );

      setBackendConnected(false);
    } finally {
      setRegisterLoading(false);
    }
  };

  // =====================================
  // DASHBOARD
  // =====================================

  const openDashboard = async () => {
    setShowDashboard(true);
    setShowEmployees(false);
    setShowRegister(false);
    setSelectedSection("All");
    setDashboardSearch("");
    setDashboardDate(
      getLocalDateString()
    );

    setDashboardLoading(true);
    setDashboardError("");

    try {
      await loadEmployees();
      await loadAttendance();
    } catch (error) {
      console.error(
        "Dashboard loading error:",
        error
      );

      setDashboardError(
        "Could not load dashboard data."
      );
    } finally {
      setDashboardLoading(false);
    }
  };

  const dashboardRecordsForDate =
    attendanceRecords.filter(
      (record) =>
        record.date === dashboardDate
    );

  const presentEmployeeKeys = [
    ...new Set(
      dashboardRecordsForDate.map(
        (record) =>
          String(
            record.employeeId ||
              record.name
          )
      )
    ),
  ];

  const lateEmployeeKeys = [
    ...new Set(
      dashboardRecordsForDate
        .filter(
          (record) =>
            String(
              record.status || ""
            ).toLowerCase() === "late"
        )
        .map((record) =>
          String(
            record.employeeId ||
              record.name
          )
        )
    ),
  ];

  const presentCount =
    presentEmployeeKeys.length;

  const lateCount =
    lateEmployeeKeys.length;

  const absentCount = Math.max(
    employees.length - presentCount,
    0
  );

  const allEmployeeSections = [
    ...new Set(
      [
        ...SECTIONS,
        ...employees.map(
          (item) => item.section
        ),
      ].filter(Boolean)
    ),
  ];

  const filteredAttendanceRecords =
    dashboardRecordsForDate.filter(
      (record) => {
        const matchesSection =
          selectedSection === "All" ||
          record.section ===
            selectedSection;

        const search =
          dashboardSearch
            .trim()
            .toLowerCase();

        const matchesSearch =
          !search ||
          String(record.name || "")
            .toLowerCase()
            .includes(search) ||
          String(
            record.employeeId || ""
          )
            .toLowerCase()
            .includes(search);

        return (
          matchesSection &&
          matchesSearch
        );
      }
    );

  const filteredEmployees =
    employees.filter((item) => {
      const search =
        employeeSearch
          .trim()
          .toLowerCase();

      if (!search) return true;

      return (
        String(item.name || "")
          .toLowerCase()
          .includes(search) ||
        String(item.id || "")
          .toLowerCase()
          .includes(search) ||
        String(item.section || "")
          .toLowerCase()
          .includes(search)
      );
    });

  // =====================================
  // CSV EXPORT
  // =====================================

  const exportAttendanceCSV = () => {
    if (
      filteredAttendanceRecords.length ===
      0
    ) {
      return;
    }

    const headers = [
      "Employee",
      "Employee ID",
      "Section",
      "Date",
      "Clock-In",
      "Status",
      "Device",
    ];

    const rows =
      filteredAttendanceRecords.map(
        (record) => [
          record.name,
          record.employeeId,
          record.section,
          record.date,
          record.clockInTime,
          record.status,
          record.deviceId ||
            DEVICE_ID,
        ]
      );

    const csv = [
      headers,
      ...rows,
    ]
      .map((row) =>
        row.map(escapeCSV).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download = `smartattend_${dashboardDate}.csv`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  // =====================================
  // RESET ATTENDANCE
  // =====================================

  const finishAttendance = () => {
    setEmployee(null);
    setStarted(false);
    setPin("");
    setError("");
    setCheckingIn(false);
    setAttendanceRecorded(false);
    setAttendanceMessage("");
    setFaceMessage("");
    setLastFaceScore(null);
  };

  const startAttendance = () => {
    setStarted(true);
    setShowDashboard(false);
    setShowEmployees(false);
    setShowRegister(false);
    setEmployee(null);
    setError("");
    setPin("");
    setFaceMessage("");
    setAttendanceRecorded(false);
    setAttendanceMessage("");
    setLastFaceScore(null);
    setCameraError("");
  };

  // =====================================
  // FACE REGISTRATION SCREEN
  // =====================================

  if (pendingFaceEmployee) {
    return (
      <div className="app">
        <header className="header">
          <div className="logo">
            <span className="logo-icon">
              S
            </span>
            <span>SmartAttend</span>
          </div>

          <StatusPill
            online={isOnline}
            backendConnected={
              backendConnected
            }
          />
        </header>

        <main className="checkin-page">
          <p className="welcome">
            FACE REGISTRATION
          </p>

          <h1>
            Register employee face
          </h1>

          <p className="description">
            Register three views so
            SmartAttend can recognize the
            employee during attendance
            check-in.
          </p>

          <div className="employee-card">
            <div className="employee-avatar">
              {pendingFaceEmployee.name
                .charAt(0)
                .toUpperCase()}
            </div>

            <div className="employee-info">
              <div>
                <span>Employee</span>
                <strong>
                  {
                    pendingFaceEmployee.name
                  }
                </strong>
              </div>

              <div>
                <span>Section</span>
                <strong>
                  {
                    pendingFaceEmployee.section
                  }
                </strong>
              </div>

              <div>
                <span>Progress</span>
                <strong>
                  {faceCaptureStep + 1} / 3
                </strong>
              </div>
            </div>
          </div>

          <p className="welcome">
            STEP {faceCaptureStep + 1} OF 3
          </p>

          <p className="description">
            {
              FACE_CAPTURE_INSTRUCTIONS[
                faceCaptureStep
              ]
            }
          </p>

          <div className="camera-box">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="camera-video"
            ></video>
          </div>

          {cameraReady &&
            !cameraError && (
              <p>
                🟢 Camera ready — position
                your face inside the guide.
              </p>
            )}

          {lastFaceScore !== null && (
            <p>
              Face detection confidence:{" "}
              {Math.round(
                lastFaceScore * 100
              )}
              %
            </p>
          )}

          {cameraError && (
            <p className="error-message">
              {cameraError}
            </p>
          )}

          {faceModelError && (
            <p className="error-message">
              {faceModelError}
            </p>
          )}

          {error && (
            <p className="error-message">
              {error}
            </p>
          )}

          {faceMessage && (
            <p>🟢 {faceMessage}</p>
          )}

          <button
            className="start-button"
            onClick={captureFaceSample}
            disabled={
              faceScanning ||
              !faceModelsLoaded ||
              !cameraReady
            }
          >
            {faceScanning
              ? "Capturing..."
              : !faceModelsLoaded
              ? "Loading Face Recognition..."
              : !cameraReady
              ? "Starting Camera..."
              : `Capture ${
                  faceCaptureStep + 1
                }`}
          </button>

          {cameraError && (
            <button
              className="back-button"
              onClick={retryCamera}
            >
              Retry Camera
            </button>
          )}

          <button
            className="back-button"
            onClick={
              cancelFaceRegistration
            }
          >
            Cancel
          </button>
        </main>
      </div>
    );
  }

  // =====================================
  // ATTENDANCE CONFIRMATION SCREEN
  // =====================================

  if (started && employee) {
    const wasLate =
      getStatusLabel(
        employee.time
      ).toLowerCase() === "late";

    return (
      <div className="app">
        <header className="header">
          <div className="logo">
            <span className="logo-icon">
              S
            </span>
            <span>SmartAttend</span>
          </div>

          <StatusPill
            online={isOnline}
            backendConnected={
              backendConnected
            }
          />
        </header>

        <main className="checkin-page">
          <p className="welcome">
            {attendanceRecorded
              ? "ATTENDANCE CONFIRMED"
              : "EMPLOYEE IDENTIFIED"}
          </p>

          <h1>
            {attendanceRecorded
              ? `Welcome, ${employee.name}`
              : `Hello, ${employee.name}`}
          </h1>

          <div className="employee-card">
            <div className="employee-avatar">
              {employee.name
                .charAt(0)
                .toUpperCase()}
            </div>

            <div className="employee-info">
              <div>
                <span>Employee</span>
                <strong>
                  {employee.name}
                </strong>
              </div>

              <div>
                <span>Section</span>
                <strong>
                  {employee.section}
                </strong>
              </div>

              <div>
                <span>Clock-in Time</span>
                <strong>
                  {employee.time}
                </strong>
              </div>
            </div>
          </div>

          {attendanceRecorded ? (
            <p>
              {wasLate ? "🟠" : "🟢"}{" "}
              {attendanceMessage}
            </p>
          ) : (
            <p className="description">
              Employee recognized.
              Recording attendance...
            </p>
          )}

          {checkingIn && (
            <p>
              Recording attendance
              securely...
            </p>
          )}

          {error && (
            <p className="error-message">
              {error}
            </p>
          )}

          <button
            className="start-button"
            onClick={finishAttendance}
            disabled={checkingIn}
          >
            Finish
          </button>
        </main>
      </div>
    );
  }

  // =====================================
  // ATTENDANCE KIOSK SCREEN
  // =====================================

  if (started) {
    return (
      <div className="app">
        <header className="header">
          <div className="logo">
            <span className="logo-icon">
              S
            </span>
            <span>SmartAttend</span>
          </div>

          <StatusPill
            online={isOnline}
            backendConnected={
              backendConnected
            }
          />
        </header>

        <main className="checkin-page">
          <p className="welcome">
            EMPLOYEE CHECK-IN
          </p>

          <h1>
            Ready to check in?
          </h1>

          <div className="dashboard-summary">
            <div className="summary-card">
              <span>Current time</span>
              <strong>
                {currentTime}
              </strong>
            </div>

            <div className="summary-card">
              <span>Today</span>
              <strong>
                {getLocalDateString()}
              </strong>
            </div>
          </div>

          <p className="description">
            Look directly at the camera.
            SmartAttend will identify the
            registered employee and record
            the attendance automatically.
          </p>

          <div className="camera-box">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="camera-video"
            ></video>
          </div>

          <p>
            {cameraReady
              ? "🟢 Camera ready"
              : "🟡 Starting camera..."}
          </p>

          {cameraReady && (
            <p>
              Device: {DEVICE_ID}
            </p>
          )}

          {lastFaceScore !== null && (
            <p>
              Last detection confidence:{" "}
              {Math.round(
                lastFaceScore * 100
              )}
              %
            </p>
          )}

          {cameraError && (
            <p className="error-message">
              {cameraError}
            </p>
          )}

          {faceModelError && (
            <p className="error-message">
              {faceModelError}
            </p>
          )}

          {faceMessage && (
            <p>🟢 {faceMessage}</p>
          )}

          {error && (
            <p className="error-message">
              {error}
            </p>
          )}

          <button
            className="start-button"
            onClick={scanFace}
            disabled={
              faceScanning ||
              !faceModelsLoaded ||
              !cameraReady ||
              checkingIn
            }
          >
            {faceScanning
              ? "Scanning Face..."
              : !faceModelsLoaded
              ? "Loading Face Recognition..."
              : !cameraReady
              ? "Starting Camera..."
              : "Scan Face"}
          </button>

          {cameraError && (
            <button
              className="back-button"
              onClick={retryCamera}
            >
              Retry Camera
            </button>
          )}

          <div className="pin-section">
            <p>
              Face recognition unavailable?
              Use the employee's personal
              4-digit PIN as the fallback
              method.
            </p>

            <input
              type="password"
              inputMode="numeric"
              placeholder="Enter 4-digit PIN"
              value={pin}
              onChange={(event) =>
                setPin(
                  event.target.value.replace(
                    /\D/g,
                    ""
                  )
                )
              }
              maxLength={4}
            />

            <button
              className="start-button"
              onClick={verifyPin}
              disabled={checkingIn}
            >
              {checkingIn
                ? "Verifying..."
                : "Verify PIN"}
            </button>
          </div>

          <button
            className="back-button"
            onClick={() => {
              setStarted(false);
              setPin("");
              setError("");
              setFaceMessage("");
              setLastFaceScore(null);
            }}
          >
            ← Back
          </button>
        </main>
      </div>
    );
  }

  // =====================================
  // MANAGER DASHBOARD
  // =====================================

  if (showDashboard) {
    const presentPercentage =
      employees.length
        ? Math.round(
            (presentCount /
              employees.length) *
              100
          )
        : 0;

    return (
      <div className="app">
        <header className="header">
          <div className="logo">
            <span className="logo-icon">
              S
            </span>
            <span>SmartAttend</span>
          </div>

          <StatusPill
            online={isOnline}
            backendConnected={
              backendConnected
            }
          />
        </header>

        <main className="dashboard-page">
          <p className="welcome">
            MANAGER DASHBOARD
          </p>

          <h1>
            Attendance Dashboard
          </h1>

          <p className="description">
            Monitor today's attendance,
            staff activity, and attendance
            history.
          </p>

          <div className="dashboard-summary">
            <div className="summary-card">
              <span>Total Staff</span>
              <strong>
                {employees.length}
              </strong>
            </div>

            <div className="summary-card">
              <span>Present</span>
              <strong>
                {presentCount}
              </strong>
              <small>
                {presentPercentage}% today
              </small>
            </div>

            <div className="summary-card">
              <span>Late</span>
              <strong>
                {lateCount}
              </strong>
            </div>

            <div className="summary-card">
              <span>Absent</span>
              <strong>
                {absentCount}
              </strong>
            </div>
          </div>

          <div className="filter-section">
            <label htmlFor="dashboard-date">
              Date
            </label>

            <input
              id="dashboard-date"
              type="date"
              value={dashboardDate}
              onChange={(event) =>
                setDashboardDate(
                  event.target.value
                )
              }
            />

            <label htmlFor="dashboard-search">
              Search
            </label>

            <input
              id="dashboard-search"
              type="text"
              placeholder="Search employee or ID..."
              value={dashboardSearch}
              onChange={(event) =>
                setDashboardSearch(
                  event.target.value
                )
              }
            />

            <label htmlFor="section-filter">
              Section
            </label>

            <select
              id="section-filter"
              value={selectedSection}
              onChange={(event) =>
                setSelectedSection(
                  event.target.value
                )
              }
            >
              <option value="All">
                All Sections
              </option>

              {allEmployeeSections.map(
                (section) => (
                  <option
                    key={section}
                    value={section}
                  >
                    {section}
                  </option>
                )
              )}
            </select>
          </div>

          {dashboardLoading && (
            <p>
              Loading attendance records...
            </p>
          )}

          {dashboardError && (
            <p className="error-message">
              {dashboardError}
            </p>
          )}

          {!dashboardLoading &&
            !dashboardError && (
              <>
                <h2>
                  Attendance Records
                </h2>

                {filteredAttendanceRecords.length ===
                0 ? (
                  <p>
                    No attendance records
                    found for the selected
                    filters.
                  </p>
                ) : (
                  <div className="attendance-table-container">
                    <table className="attendance-table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>ID</th>
                          <th>Section</th>
                          <th>Date</th>
                          <th>Clock-In</th>
                          <th>Status</th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredAttendanceRecords.map(
                          (record) => (
                            <tr
                              key={record.id}
                            >
                              <td>
                                {record.name}
                              </td>

                              <td>
                                {record.employeeId ||
                                  "—"}
                              </td>

                              <td>
                                {record.section}
                              </td>

                              <td>
                                {record.date}
                              </td>

                              <td>
                                {
                                  record.clockInTime
                                }
                              </td>

                              <td>
                                {record.status ||
                                  "Present"}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

          <button
            className="start-button"
            onClick={
              exportAttendanceCSV
            }
            disabled={
              filteredAttendanceRecords.length ===
              0
            }
          >
            Download CSV
          </button>

          <button
            className="start-button"
            onClick={async () => {
              await loadEmployees();
              await loadAttendance();
            }}
          >
            Refresh Dashboard
          </button>

          <button
            className="back-button"
            onClick={() =>
              setShowDashboard(false)
            }
          >
            ← Back
          </button>
        </main>
      </div>
    );
  }

  // =====================================
  // EMPLOYEE MANAGEMENT
  // =====================================

  if (showEmployees) {
    return (
      <div className="app">
        <header className="header">
          <div className="logo">
            <span className="logo-icon">
              S
            </span>
            <span>SmartAttend</span>
          </div>

          <StatusPill
            online={isOnline}
            backendConnected={
              backendConnected
            }
          />
        </header>

        <main className="dashboard-page">
          <p className="welcome">
            EMPLOYEE MANAGEMENT
          </p>

          <h1>
            Staff Management
          </h1>

          <p className="description">
            Register and manage employee
            faces used by SmartAttend.
          </p>

          <input
            type="text"
            placeholder="Search by name, ID or section..."
            value={employeeSearch}
            onChange={(event) =>
              setEmployeeSearch(
                event.target.value
              )
            }
          />

          {filteredEmployees.length ===
          0 ? (
            <p>
              No employees found.
            </p>
          ) : (
            <section className="features">
              {filteredEmployees.map(
                (item) => {
                  const registered =
                    normalizeDescriptors(
                      faceDescriptors[
                        item.id
                      ]
                    ).length > 0;

                  return (
                    <div
                      className="feature-card"
                      key={item.id}
                    >
                      <div className="feature-icon">
                        {item.name
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <h3>
                        {item.name}
                      </h3>

                      <p>
                        Employee ID:{" "}
                        {item.id}
                      </p>

                      <p>
                        Section:{" "}
                        {item.section}
                      </p>

                      <p>
                        {registered
                          ? "🟢 Face registered"
                          : "⚪ Face not registered"}
                      </p>

                      <button
                        className="start-button"
                        onClick={() =>
                          startFaceRegistration(
                            item
                          )
                        }
                      >
                        {registered
                          ? "Update Face"
                          : "Register Face"}
                      </button>
                    </div>
                  );
                }
              )}
            </section>
          )}

          <button
            className="back-button"
            onClick={() => {
              setShowEmployees(false);
              setEmployeeSearch("");
            }}
          >
            ← Back
          </button>
        </main>
      </div>
    );
  }

  // =====================================
  // MAIN SMARTATTEND SCREEN
  // =====================================

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <span className="logo-icon">
            S
          </span>
          <span>SmartAttend</span>
        </div>

        <StatusPill
          online={isOnline}
          backendConnected={
            backendConnected
          }
        />
      </header>

      <main className="main">
        {showRegister ? (
          <section className="register-section">
            <p className="welcome">
              EMPLOYEE MANAGEMENT
            </p>

            <h1>
              Register New Employee
            </h1>

            <p className="description">
              Add the employee's basic
              information. SmartAttend will
              then guide you through face
              registration.
            </p>

            <input
              type="text"
              placeholder="Employee full name"
              value={employeeName}
              onChange={(event) =>
                setEmployeeName(
                  event.target.value
                )
              }
            />

            <select
              value={employeeSection}
              onChange={(event) =>
                setEmployeeSection(
                  event.target.value
                )
              }
            >
              <option value="">
                Select section
              </option>

              {SECTIONS.map(
                (section) => (
                  <option
                    key={section}
                    value={section}
                  >
                    {section}
                  </option>
                )
              )}
            </select>

            <input
              type="password"
              inputMode="numeric"
              placeholder="Create 4-digit PIN"
              value={employeePin}
              onChange={(event) =>
                setEmployeePin(
                  event.target.value.replace(
                    /\D/g,
                    ""
                  )
                )
              }
              maxLength={4}
            />

            <button
              className="start-button"
              onClick={
                registerEmployee
              }
              disabled={registerLoading}
            >
              {registerLoading
                ? "Registering Employee..."
                : "Register Employee"}
            </button>

            {registerMessage && (
              <p>
                {registerMessage}
              </p>
            )}

            <button
              className="back-button"
              onClick={() => {
                setShowRegister(false);
                setRegisterMessage("");
              }}
            >
              ← Back
            </button>
          </section>
        ) : (
          <>
            <div className="backend-status">
              <p>
                {backendConnected
                  ? "🟢 Backend connected"
                  : "🔴 Backend unavailable"}
              </p>
            </div>

            <section className="hero">
              <p className="welcome">
                WELCOME TO SMARTATTEND
              </p>

              <h1>
                Smart attendance.
                <br />
                <span>
                  Simple & secure.
                </span>
              </h1>

              <p className="description">
                A modern employee
                attendance system that
                combines facial recognition,
                PIN fallback, digital
                check-in and attendance
                reporting in one place.
              </p>

              <button
                className="start-button"
                onClick={
                  startAttendance
                }
              >
                Start Attendance
              </button>

              <button
                className="back-button"
                onClick={() => {
                  setShowRegister(true);
                  setShowDashboard(false);
                  setShowEmployees(false);
                }}
              >
                Register Employee
              </button>

              <button
                className="back-button"
                onClick={() => {
                  setShowEmployees(true);
                  setShowDashboard(false);
                  setShowRegister(false);
                }}
              >
                Manage Employees
              </button>

              <button
                className="back-button"
                onClick={openDashboard}
              >
                View Attendance
              </button>
            </section>

            <section className="features">
              <div className="feature-card">
                <div className="feature-icon">
                  ◉
                </div>

                <h3>
                  Face Recognition
                </h3>

                <p>
                  Identifies registered
                  employees from live
                  camera input.
                </p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">
                  ✓
                </div>

                <h3>
                  PIN Fallback
                </h3>

                <p>
                  A four-digit personal PIN
                  provides an alternative
                  check-in method.
                </p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">
                  ▣
                </div>

                <h3>
                  Attendance Dashboard
                </h3>

                <p>
                  Track present, late and
                  absent staff and export
                  filtered CSV reports.
                </p>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;