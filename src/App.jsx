import { useEffect, useState } from "react";
import { supabase } from "./supabase";

const ADMIN_PASSWORD = "samnafuzbalmepust";

const hours = [
  "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00"
];

export default function App() {
  const isAdmin = window.location.pathname === "/admin";
  return isAdmin ? <AdminLogin /> : <BookingPage />;
}

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function BookingPage() {
  const today = getToday();

  const [selectedDate, setSelectedDate] = useState(today);
  const [appointments, setAppointments] = useState([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  async function loadAppointments() {
    const { data } = await supabase
      .from("appointments")
      .select("*")
      .eq("appointment_date", selectedDate);

    setAppointments(data || []);
  }

  useEffect(() => {
    loadAppointments();
  }, [selectedDate]);

  function getAppointment(hour) {
    return appointments.find((a) => a.appointment_time === hour);
  }

  async function reserve() {
    setMessage("");

    if (!selectedTime || !name || !phone) {
      setMessage("Izpolni ime, telefon in izberi termin.");
      return;
    }

    const { error } = await supabase.from("appointments").insert([
      {
        appointment_date: selectedDate,
        appointment_time: selectedTime,
        customer_name: name,
        phone: phone,
        status: "booked"
      }
    ]);

    if (!error) {
      setMessage("Termin je uspešno rezerviran.");
      setSelectedTime("");
      setName("");
      setPhone("");
      loadAppointments();
    } else {
      setMessage("Ta termin je žal že zaseden.");
    }
  }

  return (
    <div style={backgroundStyle}>
      <div style={cardStyle}>
        <p style={smallText}>FRIZERSKI SALON</p>
        <h1 style={titleStyle}>Rezervacija termina</h1>
        <p style={subtitleStyle}>Izberi datum, uro in vpiši svoje podatke.</p>

        <label style={labelStyle}>Datum</label>
        <input
          type="date"
          min={today}
          value={selectedDate}
          onChange={(e) => {
            setSelectedDate(e.target.value);
            setSelectedTime("");
            setMessage("");
          }}
          style={inputStyle}
        />

        <label style={labelStyle}>Prosti termini</label>

        <div style={gridStyle}>
          {hours.map((hour) => {
            const appointment = getAppointment(hour);
            const blocked = appointment?.status === "blocked";
            const booked = appointment?.status === "booked";
            const unavailable = booked || blocked;
            const selected = selectedTime === hour;

            return (
              <button
                key={hour}
                disabled={unavailable}
                onClick={() => {
                  setSelectedTime(hour);
                  setMessage("");
                }}
                style={{
                  ...timeButtonStyle,
                  background: unavailable
                    ? "#d1d5db"
                    : selected
                    ? "#111827"
                    : "#f3f4f6",
                  color: unavailable
                    ? "#6b7280"
                    : selected
                    ? "white"
                    : "#111827",
                  cursor: unavailable ? "not-allowed" : "pointer"
                }}
              >
                <strong>{hour}</strong>
                <span style={{ fontSize: "12px" }}>
                  {booked ? "Zasedeno" : blocked ? "Ni na voljo" : "Prosto"}
                </span>
              </button>
            );
          })}
        </div>

        <label style={labelStyle}>Ime in priimek</label>
        <input
          placeholder="npr. jože novak"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />

        <label style={labelStyle}>Telefon</label>
        <input
          placeholder="npr. 040 123 456"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={inputStyle}
        />

        {selectedTime && (
          <div style={summaryStyle}>
            Izbran termin: <strong>{selectedDate} ob {selectedTime}</strong>
          </div>
        )}

        {message && <div style={messageStyle}>{message}</div>}

        <button onClick={reserve} style={mainButtonStyle}>
          Rezerviraj termin
        </button>
      </div>
    </div>
  );
}

function AdminLogin() {
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(
    localStorage.getItem("adminLoggedIn") === "true"
  );

  function login() {
    if (password === ADMIN_PASSWORD) {
      localStorage.setItem("adminLoggedIn", "true");
      setIsLoggedIn(true);
    } else {
      alert("Napačno geslo.");
    }
  }

  function logout() {
    localStorage.removeItem("adminLoggedIn");
    setIsLoggedIn(false);
  }

  if (isLoggedIn) return <AdminPanel onLogout={logout} />;

  return (
    <div style={backgroundStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>Admin prijava</h1>
        <input
          type="password"
          placeholder="Geslo"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />
        <button onClick={login} style={mainButtonStyle}>
          Prijava
        </button>
      </div>
    </div>
  );
}

function AdminPanel({ onLogout }) {
  const today = getToday();

  const [appointments, setAppointments] = useState([]);
  const [blockDate, setBlockDate] = useState(today);
  const [blockTime, setBlockTime] = useState("08:00");
  const [message, setMessage] = useState("");

  async function loadAllAppointments() {
    const { data } = await supabase
      .from("appointments")
      .select("*")
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true });

    setAppointments(data || []);
  }

  useEffect(() => {
    loadAllAppointments();
  }, []);

  async function blockAppointment() {
    setMessage("");

    const existing = appointments.find(
      (a) =>
        a.appointment_date === blockDate &&
        a.appointment_time === blockTime
    );

    if (existing) {
      setMessage("Ta termin je že rezerviran ali blokiran.");
      return;
    }

    const { error } = await supabase.from("appointments").insert([
      {
        appointment_date: blockDate,
        appointment_time: blockTime,
        customer_name: "ADMIN BLOKADA",
        phone: "-",
        status: "blocked"
      }
    ]);

    if (!error) {
      setMessage("Termin je uspešno blokiran.");
      loadAllAppointments();
    } else {
      setMessage("Napaka pri blokiranju termina.");
    }
  }

  async function deleteAppointment(id) {
    const confirmDelete = confirm("Ali res želiš izbrisati termin?");
    if (!confirmDelete) return;

    await supabase.from("appointments").delete().eq("id", id);
    loadAllAppointments();
  }

  return (
    <div style={backgroundStyle}>
      <div style={adminCardStyle}>
        <div style={adminHeaderStyle}>
          <div>
            <p style={smallText}>ADMIN</p>
            <h1 style={titleStyle}>Rezervacije</h1>
          </div>

          <button onClick={onLogout} style={logoutButtonStyle}>
            Odjava
          </button>
        </div>

        <div style={blockBoxStyle}>
          <h2 style={{ marginTop: 0 }}>Blokiraj termin</h2>

          <label style={labelStyle}>Datum</label>
          <input
            type="date"
            min={today}
            value={blockDate}
            onChange={(e) => setBlockDate(e.target.value)}
            style={inputStyle}
          />

          <label style={labelStyle}>Ura</label>
          <select
            value={blockTime}
            onChange={(e) => setBlockTime(e.target.value)}
            style={inputStyle}
          >
            {hours.map((hour) => (
              <option key={hour} value={hour}>
                {hour}
              </option>
            ))}
          </select>

          <button onClick={blockAppointment} style={mainButtonStyle}>
            Blokiraj termin
          </button>

          {message && <div style={messageStyle}>{message}</div>}
        </div>

        <h2>Vsi termini</h2>

        {appointments.length === 0 && <p>Ni rezervacij.</p>}

        {appointments.map((appointment) => {
          const isBlocked = appointment.status === "blocked";

          return (
            <div key={appointment.id} style={appointmentCardStyle}>
              <div>
                <strong>
                  {appointment.appointment_date} ob{" "}
                  {appointment.appointment_time}
                </strong>

                <p style={{ margin: "6px 0" }}>
                  {isBlocked ? "Blokiran termin" : appointment.customer_name}
                </p>

                <p style={{ margin: 0, color: "#6b7280" }}>
                  {isBlocked ? "Ni na voljo za stranke" : appointment.phone}
                </p>
              </div>

              <button
                onClick={() => deleteAppointment(appointment.id)}
                style={deleteButtonStyle}
              >
                {isBlocked ? "Odblokiraj" : "Izbriši"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const backgroundStyle = {
  minHeight: "100vh",
  background: "linear-gradient(135deg, #111827, #374151)",
  padding: "30px 15px",
  boxSizing: "border-box",
  fontFamily: "Arial, sans-serif"
};

const cardStyle = {
  maxWidth: "520px",
  margin: "auto",
  background: "white",
  borderRadius: "24px",
  padding: "28px",
  boxShadow: "0 20px 50px rgba(0,0,0,0.25)"
};

const adminCardStyle = {
  maxWidth: "720px",
  margin: "auto",
  background: "white",
  borderRadius: "24px",
  padding: "28px",
  boxShadow: "0 20px 50px rgba(0,0,0,0.25)"
};

const smallText = {
  letterSpacing: "2px",
  fontSize: "12px",
  color: "#6b7280",
  margin: 0
};

const titleStyle = {
  margin: "8px 0",
  fontSize: "32px",
  color: "#111827"
};

const subtitleStyle = {
  color: "#6b7280",
  marginBottom: "24px"
};

const labelStyle = {
  display: "block",
  marginBottom: "8px",
  marginTop: "16px",
  fontWeight: "bold",
  color: "#111827"
};

const inputStyle = {
  width: "100%",
  padding: "13px",
  borderRadius: "12px",
  border: "1px solid #d1d5db",
  marginBottom: "8px",
  boxSizing: "border-box",
  fontSize: "15px"
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "10px"
};

const timeButtonStyle = {
  padding: "13px",
  border: "none",
  borderRadius: "14px",
  display: "flex",
  flexDirection: "column",
  gap: "4px"
};

const summaryStyle = {
  marginTop: "18px",
  padding: "12px",
  borderRadius: "12px",
  background: "#f3f4f6"
};

const messageStyle = {
  marginTop: "12px",
  padding: "12px",
  borderRadius: "12px",
  background: "#ecfdf5",
  color: "#065f46",
  fontWeight: "bold"
};

const mainButtonStyle = {
  width: "100%",
  marginTop: "18px",
  padding: "15px",
  background: "#111827",
  color: "white",
  border: "none",
  borderRadius: "14px",
  cursor: "pointer",
  fontSize: "16px",
  fontWeight: "bold"
};

const adminHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "15px"
};

const logoutButtonStyle = {
  padding: "10px 14px",
  background: "#374151",
  color: "white",
  border: "none",
  borderRadius: "10px",
  cursor: "pointer"
};

const appointmentCardStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "16px",
  marginTop: "12px",
  border: "1px solid #e5e7eb",
  borderRadius: "16px",
  background: "#f9fafb"
};

const deleteButtonStyle = {
  padding: "10px 14px",
  background: "#b00020",
  color: "white",
  border: "none",
  borderRadius: "10px",
  cursor: "pointer"
};

const blockBoxStyle = {
  marginTop: "20px",
  padding: "18px",
  borderRadius: "18px",
  background: "#f3f4f6"
};