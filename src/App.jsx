import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import emailjs from "@emailjs/browser";
import "./App.css";

const hours = [
  "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00"
];

const services = [
  "Moško striženje",
  "Otroško striženje",
  "Brada",
  "Striženje + brada"
];

export default function App() {
  const isAdmin = window.location.pathname === "/admin";
  return isAdmin ? <AdminLogin /> : <BookingPage />;
}

function getToday() {
  const date = new Date();
  return formatDate(date);
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function generateCancelCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isPastHour(selectedDate, hour) {
  const today = getToday();

  if (selectedDate !== today) return false;

  const now = new Date();
  const [hourPart, minutePart] = hour.split(":");

  const appointmentTime = new Date();
  appointmentTime.setHours(Number(hourPart), Number(minutePart), 0, 0);

  return appointmentTime <= now;
}

function getNextSevenDays() {
  const days = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);

    days.push({
      date: formatDate(date),
      label: date.toLocaleDateString("sl-SI", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit"
      })
    });
  }

  return days;
}

function isValidName(value) {
  return /^[A-Za-zČŠŽĆĐčšžćđ'-]{2,}\s+[A-Za-zČŠŽĆĐčšžćđ'-]{2,}(\s+[A-Za-zČŠŽĆĐčšžćđ'-]{2,})*$/.test(value.trim());
}

function isValidPhone(value) {
  return /^[0-9]{6,15}$/.test(value.trim());
}

function BookingPage() {
  const today = getToday();

  const [selectedDate, setSelectedDate] = useState(today);
  const [appointments, setAppointments] = useState([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [service, setService] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [cancelCode, setCancelCode] = useState("");
  const [showCancelForm, setShowCancelForm] = useState(false);
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

    if (!selectedTime) return setMessage("Izberi prost termin.");
    if (!service) return setMessage("Izberi storitev.");
    if (!isValidName(name)) return setMessage("Vpiši ime in priimek.");
    if (!phone.trim()) return setMessage("Vpiši telefonsko številko.");
    if (!isValidPhone(phone)) return setMessage("Vpiši pravilno telefonsko številko.");

    const confirmReservation = confirm(
      `Potrdi rezervacijo:\n\n${selectedDate} ob ${selectedTime}\nStoritev: ${service}\nIme: ${name}\nTelefon: ${phone}`
    );

    if (!confirmReservation) return;

    const { data: existingReservations } = await supabase
      .from("appointments")
      .select("id")
      .eq("phone", phone.trim())
      .eq("status", "booked")
      .gte("appointment_date", today);

    if (existingReservations && existingReservations.length > 0) {
      setMessage("S to telefonsko številko že imate aktivno rezervacijo.");
      return;
    }

    const newCancelCode = generateCancelCode();

    const { error } = await supabase.from("appointments").insert([
      {
        appointment_date: selectedDate,
        appointment_time: selectedTime,
        customer_name: name.trim(),
        phone: phone.trim(),
        service,
        note: note.trim(),
        status: "booked",
        cancel_code: newCancelCode
      }
    ]);

    if (!error) {
      try {
        await emailjs.send(
          "service_sn751ao",
          "template_bogoccg",
          {
            customer_name: name,
            phone,
            appointment_date: selectedDate,
            appointment_time: selectedTime,
            service,
            note: note || "-",
            cancel_code: newCancelCode
          },
          "2hPd-4EsO_MkOniVS"
        );
      } catch (err) {
        console.error("Napaka pri pošiljanju emaila:", err);
      }

      setMessage(`Termin je uspešno rezerviran. Koda za preklic: ${newCancelCode}`);
      setSelectedTime("");
      setService("");
      setName("");
      setPhone("");
      setNote("");
      setCancelCode("");
      loadAppointments();
    } else {
      setMessage("Ta termin je žal že zaseden.");
    }
  }

  async function cancelReservation() {
    setMessage("");

    if (!selectedDate) return setMessage("Izberi datum rezervacije.");
    if (!phone.trim()) return setMessage("Vpiši telefonsko številko za preklic.");
    if (!isValidPhone(phone)) return setMessage("Vpiši pravilno telefonsko številko.");
    if (!cancelCode.trim()) return setMessage("Vpiši kodo za preklic.");

    const confirmCancel = confirm(
      `Ali res želiš preklicati termin za datum ${selectedDate} s telefonsko številko ${phone}?`
    );

    if (!confirmCancel) return;

    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("appointment_date", selectedDate)
      .eq("phone", phone.trim())
      .eq("cancel_code", cancelCode.trim())
      .eq("status", "booked");

    if (!error) {
      setMessage("Če je bil termin najden in je bila koda pravilna, je bil preklican.");
      setPhone("");
      setCancelCode("");
      loadAppointments();
    } else {
      setMessage("Napaka pri preklicu termina.");
    }
  }

  return (
    <div style={backgroundStyle}>
      <div style={cardStyle}>
        <p style={smallText}>FRIZERSKI SALON</p>
        <h1 style={titleStyle}>Rezervacija termina</h1>
        <p style={subtitleStyle}>Izberi datum, storitev, uro in vpiši podatke.</p>

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

        <label style={labelStyle}>Storitev</label>
        <select value={service} onChange={(e) => setService(e.target.value)} style={inputStyle}>
          <option value="">Izberi storitev</option>
          {services.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>

        <label style={labelStyle}>Prosti termini</label>

        <div style={gridStyle}>
          {hours.map((hour) => {
            const appointment = getAppointment(hour);
            const blocked = appointment?.status === "blocked";
            const booked = appointment?.status === "booked";
            const past = isPastHour(selectedDate, hour);
            const unavailable = booked || blocked || past;
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
                  background: unavailable ? "#d1d5db" : selected ? "#111827" : "#f3f4f6",
                  color: unavailable ? "#6b7280" : selected ? "white" : "#111827",
                  cursor: unavailable ? "not-allowed" : "pointer"
                }}
              >
                <strong>{hour}</strong>
                <span style={{ fontSize: "12px" }}>
                  {booked ? "Zasedeno" : blocked ? "Ni na voljo" : past ? "Preteklo" : "Prosto"}
                </span>
              </button>
            );
          })}
        </div>

        <label style={labelStyle}>Ime in priimek</label>
        <input
          placeholder="npr. Jože Novak"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />

        <label style={labelStyle}>Telefon</label>
        <input
          placeholder="Telefonska številka"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
          style={inputStyle}
        />

        <label style={labelStyle}>Opomba</label>
        <textarea
          placeholder="npr. pridem 5 minut kasneje ..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }}
        />

        {selectedTime && (
          <div style={summaryStyle}>
            Izbran termin: <strong>{selectedDate} ob {selectedTime}</strong>
            {service && (
              <>
                <br />
                Storitev: <strong>{service}</strong>
              </>
            )}
          </div>
        )}

        {message && <div style={messageStyle}>{message}</div>}

        <button onClick={reserve} style={mainButtonStyle}>
          Rezerviraj termin
        </button>

        <button
          onClick={() => setShowCancelForm(!showCancelForm)}
          style={{ ...secondaryButtonStyle, marginTop: "10px" }}
        >
          {showCancelForm ? "Skrij preklic termina" : "Prekliči termin"}
        </button>

        {showCancelForm && (
          <div style={cancelBoxStyle}>
            <h2 style={{ marginTop: 0, fontSize: "20px" }}>Preklic termina</h2>
            <p style={{ color: "#6b7280", marginTop: 0 }}>
              Za preklic izberi datum ter vpiši telefonsko številko in kodo za preklic.
            </p>

            <label style={labelStyle}>Koda za preklic</label>
            <input
              placeholder="Vnesi 6-mestno kodo"
              value={cancelCode}
              onChange={(e) => setCancelCode(e.target.value.replace(/\D/g, ""))}
              style={inputStyle}
            />

            <button onClick={cancelReservation} style={{ ...secondaryButtonStyle, marginTop: "10px" }}>
              Potrdi preklic
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (session) setIsLoggedIn(true);
  }

  async function login() {
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage("Napačen email ali geslo.");
      return;
    }

    setIsLoggedIn(true);
  }

  async function logout() {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
  }

  if (isLoggedIn) return <AdminPanel onLogout={logout} />;

  return (
    <div style={backgroundStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>Admin prijava</h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />

        <input
          type="password"
          placeholder="Geslo"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        {message && <div style={messageStyle}>{message}</div>}

        <button onClick={login} style={mainButtonStyle}>
          Prijava
        </button>
      </div>
    </div>
  );
}

function AdminPanel({ onLogout }) {
  const today = getToday();
  const weekDays = getNextSevenDays();

  const [appointments, setAppointments] = useState([]);
  const [blockDate, setBlockDate] = useState(today);
  const [blockTime, setBlockTime] = useState("08:00");
  const [filterDate, setFilterDate] = useState("");
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

  function findAppointment(date, hour) {
    return appointments.find(
      (item) => item.appointment_date === date && item.appointment_time === hour
    );
  }

  async function handleSlotClick(date, hour) {
    setMessage("");

    const existing = findAppointment(date, hour);

    if (!existing) {
      const confirmBlock = confirm(`Blokiram termin ${date} ob ${hour}?`);
      if (!confirmBlock) return;

      const { error } = await supabase.from("appointments").insert([
        {
          appointment_date: date,
          appointment_time: hour,
          customer_name: "ADMIN BLOKADA",
          phone: "-",
          service: "-",
          note: "-",
          status: "blocked"
        }
      ]);

      if (!error) {
        setMessage("Termin je blokiran.");
        loadAllAppointments();
      } else {
        setMessage("Napaka pri blokiranju termina.");
      }

      return;
    }

    if (existing.status === "blocked") {
      const confirmUnblock = confirm(`Odblokiram termin ${date} ob ${hour}?`);
      if (!confirmUnblock) return;

      const { error } = await supabase
        .from("appointments")
        .delete()
        .eq("id", existing.id);

      if (!error) {
        setMessage("Termin je odblokiran.");
        loadAllAppointments();
      } else {
        setMessage("Napaka pri odblokiranju termina.");
      }

      return;
    }

    if (existing.status === "booked") {
      const confirmDelete = confirm(
        `Rezervacija:\n\n${existing.customer_name}\n${existing.phone}\n${existing.service}\n${date} ob ${hour}\n\nŽeliš izbrisati rezervacijo?`
      );

      if (!confirmDelete) return;

      const { error } = await supabase
        .from("appointments")
        .delete()
        .eq("id", existing.id);

      if (!error) {
        setMessage("Rezervacija je izbrisana.");
        loadAllAppointments();
      } else {
        setMessage("Napaka pri brisanju rezervacije.");
      }
    }
  }

  async function blockAppointment() {
    setMessage("");

    const existing = appointments.find(
      (a) => a.appointment_date === blockDate && a.appointment_time === blockTime
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
        service: "-",
        note: "-",
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

  const visibleAppointments = filterDate
    ? appointments.filter((item) => item.appointment_date === filterDate)
    : appointments;

  const bookedAppointments = visibleAppointments.filter((item) => item.status === "booked");
  const blockedAppointments = visibleAppointments.filter((item) => item.status === "blocked");

  const todaysAppointments = appointments.filter(
    (item) => item.appointment_date === today && item.status === "booked"
  );

  return (
    <div style={backgroundStyle}>
      <div style={adminCardStyle}>
        <div style={adminHeaderStyle}>
          <div>
            <p style={smallText}>ADMIN</p>
            <h1 style={titleStyle}>Rezervacije</h1>
          </div>

          <button onClick={onLogout} style={logoutButtonStyle}>Odjava</button>
        </div>

        <div style={blockBoxStyle}>
          <h2 style={{ marginTop: 0 }}>Tedenski pregled</h2>
          <p style={{ color: "#6b7280", marginTop: 0 }}>
            Klikni na okvirček: prost termin se blokira, blokiran termin se odblokira, rezerviran termin se lahko izbriše.
          </p>

          {weekDays.map((day) => (
            <div key={day.date} style={weekDayBoxStyle}>
              <h3 style={{ marginTop: 0, textTransform: "capitalize" }}>
                {day.label}
              </h3>

              <div style={weekGridStyle}>
                {hours.map((hour) => {
                  const appointment = findAppointment(day.date, hour);
                  const booked = appointment?.status === "booked";
                  const blocked = appointment?.status === "blocked";

                  return (
                    <div
                      key={`${day.date}-${hour}`}
                      onClick={() => handleSlotClick(day.date, hour)}
                      style={{
                        ...weekSlotStyle,
                        background: booked ? "#ecfdf5" : blocked ? "#fee2e2" : "#f3f4f6",
                        borderColor: booked ? "#10b981" : blocked ? "#ef4444" : "#e5e7eb",
                        cursor: "pointer",
                        transition: "0.2s ease"
                      }}
                    >
                      <strong>{hour}</strong>

                      <div style={{ fontSize: "13px", marginTop: "4px" }}>
                        {booked
                          ? appointment.customer_name
                          : blocked
                          ? "Blokirano"
                          : "Prosto"}
                      </div>

                      {booked && (
                        <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "3px" }}>
                          {appointment.service}
                        </div>
                      )}

                      <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "5px" }}>
                        Klik za urejanje
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={blockBoxStyle}>
          <h2 style={{ marginTop: 0 }}>Današnji termini</h2>

          {todaysAppointments.length === 0 && <p>Danes ni rezervacij.</p>}

          {todaysAppointments.map((appointment) => (
            <div key={appointment.id} style={appointmentCardStyle}>
              <div>
                <strong>{appointment.appointment_time}</strong>
                <p style={{ margin: "6px 0" }}><strong>{appointment.customer_name}</strong></p>
                <p style={{ margin: "4px 0", color: "#374151" }}>Telefon: {appointment.phone}</p>
                <p style={{ margin: "4px 0", color: "#374151" }}>Storitev: {appointment.service || "-"}</p>
                <p style={{ margin: "4px 0", color: "#6b7280" }}>Opomba: {appointment.note || "-"}</p>
              </div>
            </div>
          ))}
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
          <select value={blockTime} onChange={(e) => setBlockTime(e.target.value)} style={inputStyle}>
            {hours.map((hour) => (
              <option key={hour} value={hour}>{hour}</option>
            ))}
          </select>

          <button onClick={blockAppointment} style={mainButtonStyle}>
            Blokiraj termin
          </button>

          {message && <div style={messageStyle}>{message}</div>}
        </div>

        <div style={filterBoxStyle}>
          <h2 style={{ marginTop: 0 }}>Pregled terminov</h2>

          <label style={labelStyle}>Filtriraj po datumu</label>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            style={inputStyle}
          />

          {filterDate && (
            <button onClick={() => setFilterDate("")} style={secondaryButtonStyle}>
              Prikaži vse
            </button>
          )}
        </div>

        <h2>Rezervacije</h2>

        {bookedAppointments.length === 0 && <p>Ni rezervacij.</p>}

        {bookedAppointments.map((appointment) => (
          <div key={appointment.id} style={appointmentCardStyle}>
            <div>
              <strong>{appointment.appointment_date} ob {appointment.appointment_time}</strong>
              <p style={{ margin: "6px 0" }}><strong>{appointment.customer_name}</strong></p>
              <p style={{ margin: "4px 0", color: "#374151" }}>Telefon: {appointment.phone}</p>
              <p style={{ margin: "4px 0", color: "#374151" }}>Storitev: {appointment.service || "-"}</p>
              <p style={{ margin: "4px 0", color: "#6b7280" }}>Opomba: {appointment.note || "-"}</p>

              {appointment.cancel_code && (
                <p style={{ margin: "4px 0", color: "#6b7280" }}>
                  Koda za preklic: {appointment.cancel_code}
                </p>
              )}
            </div>

            <button onClick={() => deleteAppointment(appointment.id)} style={deleteButtonStyle}>
              Izbriši
            </button>
          </div>
        ))}

        <h2>Blokirani termini</h2>

        {blockedAppointments.length === 0 && <p>Ni blokiranih terminov.</p>}

        {blockedAppointments.map((appointment) => (
          <div key={appointment.id} style={appointmentCardStyle}>
            <div>
              <strong>{appointment.appointment_date} ob {appointment.appointment_time}</strong>
              <p style={{ margin: "6px 0", color: "#6b7280" }}>
                Ni na voljo za stranke
              </p>
            </div>

            <button onClick={() => deleteAppointment(appointment.id)} style={deleteButtonStyle}>
              Odblokiraj
            </button>
          </div>
        ))}
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
  maxWidth: "980px",
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

const secondaryButtonStyle = {
  width: "100%",
  padding: "12px",
  background: "#374151",
  color: "white",
  border: "none",
  borderRadius: "12px",
  cursor: "pointer",
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
  gap: "15px",
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
  cursor: "pointer",
  whiteSpace: "nowrap"
};

const blockBoxStyle = {
  marginTop: "20px",
  padding: "18px",
  borderRadius: "18px",
  background: "#f3f4f6"
};

const filterBoxStyle = {
  marginTop: "20px",
  padding: "18px",
  borderRadius: "18px",
  background: "#f9fafb",
  border: "1px solid #e5e7eb"
};

const cancelBoxStyle = {
  marginTop: "22px",
  padding: "18px",
  borderRadius: "18px",
  background: "#f9fafb",
  border: "1px solid #e5e7eb"
};

const weekDayBoxStyle = {
  marginTop: "18px",
  padding: "16px",
  borderRadius: "16px",
  background: "white",
  border: "1px solid #e5e7eb"
};

const weekGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
  gap: "10px"
};

const weekSlotStyle = {
  padding: "10px",
  borderRadius: "12px",
  border: "1px solid #e5e7eb",
  minHeight: "78px"
};