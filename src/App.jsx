
import { useState, useEffect, useRef } from "react";

import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "firebase/auth";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  deleteField,
  addDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  writeBatch
} from "firebase/firestore";

import { auth, db } from "./firebase";

const googleProvider = new GoogleAuthProvider();

function PixelDinosaur() {
  return (
    <svg className="dino-logo" viewBox="0 0 32 32" aria-hidden="true" shapeRendering="crispEdges">
      <rect x="7" y="3" width="15" height="4" fill="#A5B99F" />
      <rect x="4" y="7" width="21" height="4" fill="#A5B99F" />
      <rect x="2" y="11" width="25" height="10" fill="#A5B99F" />
      <rect x="5" y="21" width="20" height="4" fill="#A5B99F" />
      <rect x="8" y="25" width="4" height="5" fill="#A5B99F" />
      <rect x="20" y="25" width="4" height="5" fill="#A5B99F" />
      <rect x="1" y="14" width="4" height="4" fill="#A5B99F" />
      <rect x="22" y="5" width="7" height="7" fill="#A5B99F" />
      <rect x="25" y="8" width="2" height="2" fill="#26372D" />
      <rect x="11" y="13" width="3" height="3" fill="#26372D" />
      <rect x="16" y="13" width="3" height="3" fill="#26372D" />
      <rect x="13" y="18" width="6" height="2" fill="#26372D" />
    </svg>
  );
}

const CHANNELS = [
  "Website Coding Team",
  "StuCo Representatives"
];

function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // The card starts at its natural size and becomes explicitly sized when dragged.
  const [windowSize, setWindowSize] = useState({ width: null, height: null });
  const resizeStart = useRef(null);

  function startWindowResize(event) {
    event.preventDefault();
    const rect = event.currentTarget.parentElement.getBoundingClientRect();

    resizeStart.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      width: rect.width,
      height: rect.height
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveWindowResize(event) {
    if (!resizeStart.current) return;

    const start = resizeStart.current;
    const maxWidth = Math.max(360, window.innerWidth - 36);
    const maxHeight = Math.max(360, window.innerHeight - 36);

    setWindowSize({
      width: Math.min(maxWidth, Math.max(360, start.width + event.clientX - start.x)),
      height: Math.min(maxHeight, Math.max(360, start.height + event.clientY - start.y))
    });
  }

  function stopWindowResize(event) {
    resizeStart.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const resizedCardStyle = {
    ...(windowSize.width ? { width: `${windowSize.width}px`, maxWidth: "calc(100vw - 36px)" } : {}),
    ...(windowSize.height ? { height: `${windowSize.height}px`, maxHeight: "calc(100vh - 36px)" } : {})
  };

  const resizeHandle = (
    <div
      className="resize-handle"
      role="separator"
      aria-label="Drag to resize window"
      title="Drag to resize"
      onPointerDown={startWindowResize}
      onPointerMove={moveWindowResize}
      onPointerUp={stopWindowResize}
      onPointerCancel={stopWindowResize}
    />
  );

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminCode, setAdminCode] = useState("");

  const [page, setPage] = useState("dashboard");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Student message form
  const [selectedChannels, setSelectedChannels] = useState([CHANNELS[0]]);
  const [subject, setSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");

  // Student conversations
  const [studentMessages, setStudentMessages] = useState([]);
  const [studentReplies, setStudentReplies] = useState({});
  const [studentReplyDrafts, setStudentReplyDrafts] = useState({});
  const [selectedThread, setSelectedThread] = useState(null);
  const [studentMessagesLoading, setStudentMessagesLoading] = useState(true);

  // Administrator inbox
  const [adminMessages, setAdminMessages] = useState([]);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [selectedAdminMessage, setSelectedAdminMessage] = useState(null);
  const [adminReply, setAdminReply] = useState("");
  const [adminThreadReplies, setAdminThreadReplies] = useState([]);

  // Announcements
  const [announcements, setAnnouncements] = useState([]);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState([]);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");

  // --------------------------------------------------
  // AUTHENTICATION
  // --------------------------------------------------

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAdmin(false);
      setPage("dashboard");
      setNotice("");
      setError("");

      if (currentUser) {
        try {
          const registrationRef = doc(
            db,
            "adminRegistrations",
            currentUser.uid
          );

          const registration = await getDoc(registrationRef);

          setIsAdmin(
            registration.exists() &&
            Boolean(registration.data().registeredAt)
          );
        } catch (err) {
          console.error("Admin status check failed:", err);
          setIsAdmin(false);
        }
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  async function handleGoogleLogin() {
    setError("");
    setBusy(true);

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleEmailAuth(e) {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      if (isCreatingAccount) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await signOut(auth);

    setPage("dashboard");
    setIsAdmin(false);
    setAdminCode("");
    setNotice("");
    setStudentMessages([]);
    setStudentReplies({});
    setAnnouncements([]);
    setDismissedAnnouncements([]);
  }

  // --------------------------------------------------
  // ADMIN REGISTRATION
  // --------------------------------------------------

  async function handleAdminRegistration(e) {
    e.preventDefault();

    if (!user || !adminCode.trim()) return;

    setError("");
    setBusy(true);

    const registrationRef = doc(
      db,
      "adminRegistrations",
      user.uid
    );

    try {
      try {
        await setDoc(registrationRef, {
          code: adminCode.trim()
        });
      } catch (createError) {
        console.log("Registration document already exists or creation was denied.");
      }

      await updateDoc(registrationRef, {
        code: deleteField(),
        registeredAt: serverTimestamp()
      });

      setIsAdmin(true);
      setAdminCode("");
      setPage("dashboard");
      setNotice("Administrator registration successful.");

    } catch (err) {
      console.error("Admin registration failed:", err);
      setError("Registration failed. Check your code and try again.");
    } finally {
      setBusy(false);
    }
  }

  // --------------------------------------------------
  // STUDENT MESSAGE SUBMISSION
  // --------------------------------------------------

  async function handleMessageSubmit(e) {
    e.preventDefault();

    if (
      !user ||
      !subject.trim() ||
      !messageBody.trim() ||
      selectedChannels.length === 0
    ) {
      setError("Please choose at least one channel and complete your message.");
      return;
    }

    setError("");
    setNotice("");
    setBusy(true);

    try {
      const batch = writeBatch(db);

      // Create a separate anonymous message for each selected channel.
      // No student UID or email is stored in the public message documents.
      selectedChannels.forEach((selectedChannel) => {
        const messageRef = doc(collection(db, "messages"));

        batch.set(messageRef, {
          channel: selectedChannel,
          subject: subject.trim(),
          body: messageBody.trim(),
          createdAt: serverTimestamp()
        });

        // Private routing record lets this student retrieve replies.
        const privateMessageRef = doc(
          db,
          "users",
          user.uid,
          "submittedMessages",
          messageRef.id
        );

        batch.set(privateMessageRef, {
          channel: selectedChannel,
          subject: subject.trim(),
          body: messageBody.trim(),
          createdAt: serverTimestamp()
        });
      });

      await batch.commit();

      setSubject("");
      setMessageBody("");
      setSelectedChannels([CHANNELS[0]]);
      setPage("dashboard");
      setNotice(
        selectedChannels.length === 1
          ? `Your anonymous message has been sent to ${selectedChannels[0]}.`
          : "Your anonymous message has been sent to both channels."
      );

    } catch (err) {
      console.error("Message submission failed:", err);
      setError("Your message could not be sent. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // --------------------------------------------------
  // STUDENT: LOAD THEIR OWN MESSAGES
  // --------------------------------------------------

  useEffect(() => {
    if (!user || isAdmin) return;

    setStudentMessagesLoading(true);

    const messagesQuery = query(
      collection(db, "users", user.uid, "submittedMessages"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        setStudentMessages(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data()
          }))
        );

        setStudentMessagesLoading(false);
      },
      (err) => {
        console.error("Student messages failed:", err);
        setStudentMessagesLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, isAdmin]);

  // Listen to replies for each of the student's messages.
  useEffect(() => {
    if (!user || isAdmin || studentMessages.length === 0) {
      setStudentReplies({});
      return;
    }

    const unsubscribers = studentMessages.map((item) => {
      const repliesQuery = query(
        collection(db, "messages", item.id, "replies"),
        orderBy("createdAt", "asc")
      );

      return onSnapshot(
        repliesQuery,
        (snapshot) => {
          setStudentReplies((previous) => ({
            ...previous,
            [item.id]: snapshot.docs.map((reply) => ({
              id: reply.id,
              ...reply.data()
            }))
          }));
        },
        (err) => {
          console.error("Reply loading failed:", err);
        }
      );
    });

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [user, isAdmin, studentMessages]);

  // --------------------------------------------------
  // STUDENT: REPLY IN THEIR CONVERSATION
  // --------------------------------------------------

  async function handleStudentReply(e, message) {
    e.preventDefault();
    const body = studentReplyDrafts[message.id]?.trim();
    if (!body) return;

    setBusy(true);
    setError("");

    try {
      await addDoc(
        collection(db, "messages", message.id, "replies"),
        {
          body,
          sender: "student",
          createdAt: serverTimestamp()
        }
      );
      setStudentReplyDrafts((previous) => ({ ...previous, [message.id]: "" }));
    } catch (err) {
      console.error("Student reply failed:", err);
      setError("Your message could not be sent. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // --------------------------------------------------
  // ADMIN: LOAD INBOX
  // --------------------------------------------------

  useEffect(() => {
    if (!user || !isAdmin || page !== "inbox") return;

    setInboxLoading(true);

    const messagesQuery = query(
      collection(db, "messages"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        setAdminMessages(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data()
          }))
        );

        setInboxLoading(false);
      },
      (err) => {
        console.error("Inbox loading failed:", err);
        setError("Unable to load the inbox.");
        setInboxLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, isAdmin, page]);

  // Keep the selected administrator conversation live as replies arrive.
  useEffect(() => {
    if (!selectedAdminMessage) {
      setAdminThreadReplies([]);
      return;
    }

    const repliesQuery = query(
      collection(db, "messages", selectedAdminMessage.id, "replies"),
      orderBy("createdAt", "asc")
    );

    return onSnapshot(repliesQuery, (snapshot) => {
      setAdminThreadReplies(snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data()
      })));
    }, (err) => console.error("Conversation loading failed:", err));
  }, [selectedAdminMessage]);

  // --------------------------------------------------
  // ADMIN: REPLY TO STUDENT
  // --------------------------------------------------

  async function handleAdminReply(e) {
    e.preventDefault();

    if (!selectedAdminMessage || !adminReply.trim()) return;

    setBusy(true);
    setError("");

    try {
      await addDoc(
        collection(
          db,
          "messages",
          selectedAdminMessage.id,
          "replies"
        ),
        {
          body: adminReply.trim(),
          sender: "admin",
          createdAt: serverTimestamp()
        }
      );

      setAdminReply("");
      setNotice("Reply sent successfully.");

    } catch (err) {
      console.error("Reply failed:", err);
      setError("Your reply could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  // --------------------------------------------------
  // ADMIN: CREATE ANNOUNCEMENT
  // --------------------------------------------------

  async function handleAnnouncementSubmit(e) {
    e.preventDefault();

    if (!announcementTitle.trim() || !announcementBody.trim()) return;

    setBusy(true);
    setError("");

    try {
      await addDoc(collection(db, "announcements"), {
        title: announcementTitle.trim(),
        body: announcementBody.trim(),
        createdAt: serverTimestamp()
      });

      setAnnouncementTitle("");
      setAnnouncementBody("");
      setNotice("Announcement published successfully.");
      setPage("dashboard");

    } catch (err) {
      console.error("Announcement failed:", err);
      setError("Unable to publish announcement.");
    } finally {
      setBusy(false);
    }
  }

  // --------------------------------------------------
  // STUDENT: ANNOUNCEMENTS
  // --------------------------------------------------

  useEffect(() => {
    if (!user || isAdmin) return;

    const announcementsQuery = query(
      collection(db, "announcements"),
      orderBy("createdAt", "desc")
    );

    const unsubscribeAnnouncements = onSnapshot(
      announcementsQuery,
      (snapshot) => {
        setAnnouncements(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data()
          }))
        );
      },
      (err) => console.error("Announcements failed:", err)
    );

    const dismissedQuery = collection(
      db,
      "users",
      user.uid,
      "dismissedAnnouncements"
    );

    const unsubscribeDismissed = onSnapshot(
      dismissedQuery,
      (snapshot) => {
        setDismissedAnnouncements(
          snapshot.docs.map((item) => item.id)
        );
      },
      (err) => console.error("Dismissed announcements failed:", err)
    );

    return () => {
      unsubscribeAnnouncements();
      unsubscribeDismissed();
    };
  }, [user, isAdmin]);

  const activeAnnouncement = !isAdmin
    ? announcements.find(
        (item) => !dismissedAnnouncements.includes(item.id)
      )
    : null;

  async function dismissAnnouncement() {
    if (!user || !activeAnnouncement) return;

    try {
      await setDoc(
        doc(
          db,
          "users",
          user.uid,
          "dismissedAnnouncements",
          activeAnnouncement.id
        ),
        {
          dismissedAt: serverTimestamp()
        }
      );

    } catch (err) {
      console.error("Announcement dismissal failed:", err);
      setError("Unable to dismiss announcement.");
    }
  }

  // --------------------------------------------------
  // HELPERS
  // --------------------------------------------------

  function formatDate(timestamp) {
    if (!timestamp?.toDate) return "Just now";

    return timestamp.toDate().toLocaleString();
  }

  if (loading) {
    return (
      <>
        <style>{styles}</style>
        <div className="loading-screen">LOADING...</div>
      </>
    );
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <>
      <style>{styles}</style>

      <main className="app">

        {!user ? (
          <section className="login-card resizable-card" style={resizedCardStyle}>

            <div className="pixel-mark"><PixelDinosaur /></div>

            <h1>Welcome, Student</h1>
            <p className="subtitle">Please log in:</p>

            {error && <p className="error">{error}</p>}

            <button
              className="auth-button"
              onClick={handleGoogleLogin}
              disabled={busy}
            >
              <span className="google-icon">G</span>
              Continue with Google
            </button>

            <div className="divider">
              <span>OR</span>
            </div>

            <button
              className="auth-button"
              onClick={() => {
                setShowEmailForm(!showEmailForm);
                setError("");
              }}
            >
              Email + Password
            </button>

            {showEmailForm && (
              <form onSubmit={handleEmailAuth} className="email-form">

                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />

                <button
                  type="submit"
                  className="primary-button"
                  disabled={busy}
                >
                  {busy
                    ? "PLEASE WAIT..."
                    : isCreatingAccount
                      ? "CREATE ACCOUNT"
                      : "LOG IN"}
                </button>

                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setIsCreatingAccount(!isCreatingAccount);
                    setError("");
                  }}
                >
                  {isCreatingAccount
                    ? "Already have an account? Log in"
                    : "Don't have an account? Create one"}
                </button>

              </form>
            )}

            <footer>TELL US WHAT YOU THINK.</footer>
            {resizeHandle}
          </section>

        ) : (
          <section className="dashboard-card resizable-card" style={resizedCardStyle}>

            <header className="dashboard-header">
              <div className="brand-role">
                <div className="pixel-mark small"><PixelDinosaur /></div>
                <span className="role-label">{isAdmin ? "Admin" : "Student"}</span>
              </div>

              <button
                className="logout-button"
                onClick={handleLogout}
              >
                LOG OUT
              </button>
            </header>

            {notice && (
              <p className="success">{notice}</p>
            )}

            {error && (
              <p className="error">{error}</p>
            )}

            {/* DASHBOARD */}

            {page === "dashboard" && (
              <>
                <h1>Welcome!</h1>

                <p className="subtitle">
                  What would you like to do today?
                </p>

                <p className="user-email">{user.email}</p>

                <div className="options">

                  <button
                    className="option-button"
                    onClick={() => {
                      setError("");
                      setNotice("");
                      setPage("message");
                    }}
                  >
                    <span className="option-number">01 /</span>

                    <span className="option-content">
                      <strong>Write a Message</strong>
                      <small>
                        Send anonymous feedback to a team.
                      </small>
                    </span>

                    <span className="arrow">→</span>
                  </button>

                  <button
                    className="option-button"
                    onClick={() => setPage("report")}
                  >
                    <span className="option-number">02 /</span>

                    <span className="option-content">
                      <strong>File a Report</strong>
                      <small>
                        Report an issue or bring a concern to our attention.
                      </small>
                    </span>

                    <span className="arrow">→</span>
                  </button>

                  {!isAdmin && (
                    <button
                      className="option-button"
                      onClick={() => setPage("my-messages")}
                    >
                      <span className="option-number">03 /</span>

                      <span className="option-content">
                        <strong>My Messages</strong>
                        <small>
                          View replies to your anonymous messages.
                        </small>
                      </span>

                      <span className="arrow">→</span>
                    </button>
                  )}

                </div>

                {isAdmin && (
                  <>
                    <button
                      className="admin-button"
                      onClick={() => {
                        setError("");
                        setPage("inbox");
                      }}
                    >
                      INBOX →
                    </button>

                    <button
                      className="admin-secondary-button"
                      onClick={() => {
                        setError("");
                        setPage("announcement");
                      }}
                    >
                      CREATE ANNOUNCEMENT
                    </button>

                    <button
                      className="admin-secondary-button"
                      onClick={() => setPage("admin")}
                    >
                      ADMIN DASHBOARD
                    </button>
                  </>
                )}

                {!isAdmin && (
                  <button
                    className="text-button admin-register-link"
                    onClick={() => {
                      setError("");
                      setPage("admin-register");
                    }}
                  >
                    Register as an administrator
                  </button>
                )}
              </>
            )}

            {/* STUDENT MESSAGE FORM */}

            {page === "message" && !isAdmin && (
              <div className="subpage">

                <span className="option-number">
                  STUDENT FEEDBACK / NEW MESSAGE
                </span>

                <h1>Write a Message</h1>

                <p className="subtitle">
                  Your message is anonymous. Choose which team should receive it.
                </p>

                <form
                  className="email-form"
                  onSubmit={handleMessageSubmit}
                >

                  <label>Send to</label>

                  <div className="channel-options">
                    {CHANNELS.map((item) => (
                      <label className="channel-option" key={item}>
                        <input
                          className="channel-checkbox"
                          type="checkbox"
                          checked={selectedChannels.includes(item)}
                          onChange={(e) => {
                            setSelectedChannels((previous) =>
                              e.target.checked
                                ? [...previous, item]
                                : previous.filter((selected) => selected !== item)
                            );
                          }}
                        />
                        <span>{item}</span>
                      </label>
                    ))}
                  </div>

                  <p className="privacy-note">
                    Select one channel or both. If you select both, your message will be delivered separately to each team.
                  </p>

                  <label>Subject</label>

                  <input
                    type="text"
                    placeholder="Message subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    maxLength={120}
                    required
                  />

                  <label>Message</label>

                  <textarea
                    className="message-input"
                    placeholder="Write your message here..."
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                    maxLength={5000}
                    rows={7}
                    required
                  />

                  <p className="privacy-note">
                    Your name and email will not be shown to administrators.
                  </p>

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={busy}
                  >
                    {busy ? "SENDING..." : "SEND ANONYMOUS MESSAGE"}
                  </button>

                </form>

                <button
                  className="text-button"
                  onClick={() => setPage("dashboard")}
                >
                  ← Back to Dashboard
                </button>

              </div>
            )}

            {/* STUDENT MESSAGE HISTORY */}

            {page === "my-messages" && !isAdmin && (
              <div className="subpage">

                <span className="option-number">
                  STUDENT ACCOUNT / MESSAGE HISTORY
                </span>

                <h1>My Messages</h1>

                <p className="subtitle">
                  Your anonymous submissions and administrator replies.
                </p>

                {studentMessagesLoading ? (
                  <div className="inbox-empty">
                    LOADING YOUR MESSAGES...
                  </div>
                ) : studentMessages.length === 0 ? (
                  <div className="inbox-empty">
                    <div className="empty-icon">✉</div>
                    <strong>No messages yet.</strong>
                    <p>Your submitted messages will appear here.</p>
                  </div>
                ) : (
                  <div className="message-list">

                    {studentMessages.map((item) => {
                      const replies = studentReplies[item.id] || [];

                      return (
                        <article className="message-card" key={item.id}>

                          <span className="message-channel">
                            {item.channel}
                          </span>

                          <h2>{item.subject}</h2>

                          <span className="message-date">
                            {formatDate(item.createdAt)}
                          </span>

                          <button
                            className="thread-button"
                            onClick={() => setSelectedThread(
                              selectedThread === item.id ? null : item.id
                            )}
                          >
                            {selectedThread === item.id
                              ? "CLOSE CONVERSATION ↑"
                              : `OPEN CHAT (${replies.length} REPLIES) ↓`}
                          </button>

                          {selectedThread === item.id && (
                            <div className="chat-panel">
                              <div className="chat-message student-chat-message">
                                <span className="chat-sender">YOU · ORIGINAL MESSAGE</span>
                                <p>{item.body || "Original message text is unavailable for this older submission."}</p>
                                <span className="chat-time">{formatDate(item.createdAt)}</span>
                              </div>

                              {replies.map((reply) => (
                                <div
                                  className={`chat-message ${reply.sender === "student" ? "student-chat-message" : "admin-chat-message"}`}
                                  key={reply.id}
                                >
                                  <span className="chat-sender">
                                    {reply.sender === "student" ? "YOU" : "STUCO TEAM"}
                                  </span>
                                  <p>{reply.body}</p>
                                  <span className="chat-time">{formatDate(reply.createdAt)}</span>
                                </div>
                              ))}

                              <form
                                className="chat-compose"
                                onSubmit={(e) => handleStudentReply(e, item)}
                              >
                                <textarea
                                  placeholder="Write a message..."
                                  value={studentReplyDrafts[item.id] || ""}
                                  onChange={(e) => setStudentReplyDrafts((previous) => ({
                                    ...previous,
                                    [item.id]: e.target.value
                                  }))}
                                  rows={2}
                                  maxLength={5000}
                                  required
                                />
                                <button type="submit" className="primary-button" disabled={busy}>
                                  {busy ? "SENDING..." : "SEND MESSAGE"}
                                </button>
                              </form>
                            </div>
                          )}

                        </article>
                      );
                    })}

                  </div>
                )}

                <button
                  className="text-button"
                  onClick={() => setPage("dashboard")}
                >
                  ← Back to Dashboard
                </button>

              </div>
            )}

            {/* ADMIN INBOX */}

            {page === "inbox" && isAdmin && (
              <div className="subpage">

                <span className="option-number">
                  ADMINISTRATOR / MESSAGES
                </span>

                <h1>Inbox</h1>

                <p className="subtitle">
                  Anonymous messages from students across both channels.
                </p>

                <div className="inbox-count">
                  {adminMessages.length} MESSAGES
                </div>

                {inboxLoading ? (
                  <div className="inbox-empty">
                    LOADING INBOX...
                  </div>
                ) : adminMessages.length === 0 ? (
                  <div className="inbox-empty">
                    <div className="empty-icon">✉</div>
                    <strong>Your inbox is empty.</strong>
                    <p>Student messages will appear here.</p>
                  </div>
                ) : (
                  <div className="message-list">

                    {adminMessages.map((item) => (
                      <article
                        className="message-card"
                        key={item.id}
                      >

                        <span className="message-channel">
                          {item.channel}
                        </span>

                        <h2>{item.subject}</h2>

                        <span className="message-date">
                          {formatDate(item.createdAt)}
                        </span>

                        <p className="message-body">
                          {item.body}
                        </p>

                        <button
                          className="thread-button"
                          onClick={() => {
                            setSelectedAdminMessage(item);
                            setAdminReply("");
                            setError("");
                          }}
                        >
                          OPEN CONVERSATION →
                        </button>

                      </article>
                    ))}

                  </div>
                )}

                <button
                  className="text-button"
                  onClick={() => setPage("dashboard")}
                >
                  ← Back to Dashboard
                </button>

              </div>
            )}

            {/* ADMIN REPLY */}

            {selectedAdminMessage && isAdmin && (
              <div className="modal-overlay">

                <div className="modal-card">

                  <span className="option-number">
                    ADMINISTRATOR / REPLY
                  </span>

                  <h1>Reply</h1>

                  <p className="message-channel">
                    {selectedAdminMessage.channel}
                  </p>

                  <h2>{selectedAdminMessage.subject}</h2>

                  <div className="chat-panel admin-chat-panel">
                    <div className="chat-message admin-chat-message">
                      <span className="chat-sender">STUDENT · ANONYMOUS</span>
                      <p>{selectedAdminMessage.body}</p>
                      <span className="chat-time">{formatDate(selectedAdminMessage.createdAt)}</span>
                    </div>

                    {adminThreadReplies.map((reply) => (
                      <div
                        className={`chat-message ${reply.sender === "admin" ? "admin-chat-message" : "student-chat-message"}`}
                        key={reply.id}
                      >
                        <span className="chat-sender">
                          {reply.sender === "admin" ? "YOU · STUCO TEAM" : "STUDENT · ANONYMOUS"}
                        </span>
                        <p>{reply.body}</p>
                        <span className="chat-time">{formatDate(reply.createdAt)}</span>
                      </div>
                    ))}
                  </div>

                  <form className="chat-compose" onSubmit={handleAdminReply}>
                    <textarea
                      placeholder="Write a message..."
                      value={adminReply}
                      onChange={(e) => setAdminReply(e.target.value)}
                      rows={2}
                      maxLength={5000}
                      required
                    />
                    <button type="submit" className="primary-button" disabled={busy}>
                      {busy ? "SENDING..." : "SEND MESSAGE"}
                    </button>
                  </form>

                  <button
                    className="text-button"
                    onClick={() => setSelectedAdminMessage(null)}
                  >
                    CANCEL
                  </button>

                </div>

              </div>
            )}

            {/* ADMIN ANNOUNCEMENT FORM */}

            {page === "announcement" && isAdmin && (
              <div className="subpage">

                <span className="option-number">
                  ADMINISTRATOR / ANNOUNCEMENTS
                </span>

                <h1>Announcement</h1>

                <p className="subtitle">
                  Publish a message that students will see when they next open the app.
                </p>

                <form
                  className="email-form"
                  onSubmit={handleAnnouncementSubmit}
                >

                  <label>Announcement title</label>

                  <input
                    type="text"
                    placeholder="Announcement title"
                    value={announcementTitle}
                    onChange={(e) => setAnnouncementTitle(e.target.value)}
                    maxLength={120}
                    required
                  />

                  <label>Announcement message</label>

                  <textarea
                    className="message-input"
                    placeholder="Write your announcement..."
                    value={announcementBody}
                    onChange={(e) => setAnnouncementBody(e.target.value)}
                    maxLength={5000}
                    rows={7}
                    required
                  />

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={busy}
                  >
                    {busy ? "PUBLISHING..." : "PUBLISH ANNOUNCEMENT"}
                  </button>

                </form>

                <button
                  className="text-button"
                  onClick={() => setPage("dashboard")}
                >
                  ← Back to Dashboard
                </button>

              </div>
            )}

            {/* ADMIN REGISTRATION */}

            {page === "admin-register" && (
              <div className="subpage">

                <span className="option-number">
                  ACCOUNT SETTINGS / ADMIN
                </span>

                <h1>Admin Registration</h1>

                <p className="subtitle">
                  Enter your administrator registration code.
                </p>

                <form
                  className="email-form"
                  onSubmit={handleAdminRegistration}
                >

                  <input
                    type="password"
                    placeholder="Admin registration code"
                    value={adminCode}
                    onChange={(e) => setAdminCode(e.target.value)}
                    required
                  />

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={busy}
                  >
                    {busy ? "VERIFYING..." : "REGISTER AS ADMIN"}
                  </button>

                </form>

                <button
                  className="text-button"
                  onClick={() => setPage("dashboard")}
                >
                  ← Back to Dashboard
                </button>

              </div>
            )}

            {/* ADMIN DASHBOARD */}

            {page === "admin" && isAdmin && (
              <div className="subpage">

                <span className="option-number">
                  ADMINISTRATOR / CONTROL PANEL
                </span>

                <h1>Admin Dashboard</h1>

                <p className="subtitle">
                  Manage student communication.
                </p>

                <button
                  className="admin-button"
                  onClick={() => setPage("inbox")}
                >
                  OPEN INBOX →
                </button>

                <button
                  className="admin-secondary-button"
                  onClick={() => setPage("announcement")}
                >
                  CREATE ANNOUNCEMENT
                </button>

                <button
                  className="text-button"
                  onClick={() => setPage("dashboard")}
                >
                  ← Back to Dashboard
                </button>

              </div>
            )}

            {/* REPORT PLACEHOLDER */}

            {page === "report" && (
              <div className="subpage">

                <span className="option-number">
                  02 / FILE A REPORT
                </span>

                <h1>File a Report</h1>

                <p className="subtitle">
                  The report submission form will go here.
                </p>

                <button
                  className="text-button"
                  onClick={() => setPage("dashboard")}
                >
                  ← Back to Dashboard
                </button>

              </div>
            )}

            <footer>TELL US WHAT YOU THINK.</footer>
            {resizeHandle}

          </section>
        )}

      </main>

      {/* ANNOUNCEMENT POPUP */}

      {user && activeAnnouncement && (
        <div className="modal-overlay announcement-overlay">

          <div className="modal-card announcement-card">

            <span className="option-number">
              STUDENT COUNCIL / ANNOUNCEMENT
            </span>

            <div className="announcement-icon">!</div>

            <h1>{activeAnnouncement.title}</h1>

            <p className="announcement-text">
              {activeAnnouncement.body}
            </p>

            <span className="message-date">
              {formatDate(activeAnnouncement.createdAt)}
            </span>

            <button
              className="primary-button dismiss-button"
              onClick={dismissAnnouncement}
            >
              DISMISS
            </button>

          </div>

        </div>
      )}

    </>
  );
}

const styles = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Silkscreen:wght@400;700&display=swap');

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: #080B09;
  color: #E6E9DF;
  font-family: 'DM Sans', sans-serif;
}

button, input, textarea, select {
  font: inherit;
}

button {
  cursor: pointer;
}

button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.app {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 30px 18px;
}

.login-card,
.dashboard-card {
  width: 100%;
  max-width: 620px;
  background: #394B40;
  border-radius: 12px;
  padding: 45px;
  box-shadow: 9px 9px 0 #202B24;
}

.resizable-card {
  position: relative;
  overflow: auto;
  min-width: min(360px, calc(100vw - 36px));
  min-height: 360px;
  max-height: calc(100vh - 60px);
}

.resize-handle {
  position: absolute;
  right: 5px;
  bottom: 5px;
  z-index: 5;
  width: 22px;
  height: 22px;
  cursor: nwse-resize;
  touch-action: none;
  background:
    linear-gradient(135deg, transparent 0 48%, #A5B99F 49% 55%, transparent 56%),
    linear-gradient(135deg, transparent 0 65%, #A5B99F 66% 72%, transparent 73%),
    linear-gradient(135deg, transparent 0 82%, #A5B99F 83% 89%, transparent 90%);
}

.resize-handle:hover {
  filter: brightness(1.35);
}

.login-card {
  max-width: 490px;
}

.pixel-mark {
  width: 58px;
  height: 58px;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #26372D;
  border: 1px solid #829283;
  margin-bottom: 35px;
}

.pixel-mark.small {
  width: 42px;
  height: 42px;
  margin: 0;
}

.dino-logo {
  display: block;
  width: 34px;
  height: 34px;
  image-rendering: pixelated;
}

.pixel-mark.small .dino-logo {
  width: 30px;
  height: 30px;
}

.brand-role {
  display: flex;
  align-items: center;
  gap: 13px;
}

.role-label {
  color: #E6E9DF;
  font-family: 'Silkscreen', sans-serif;
  font-size: 12px;
  letter-spacing: 1px;
}

h1 {
  font-family: 'Silkscreen', sans-serif;
  font-size: clamp(23px, 5vw, 31px);
  font-weight: 400;
  line-height: 1.5;
  margin: 0 0 8px;
  color: #E6E9DF;
  overflow-wrap: anywhere;
}

h2 {
  color: #E6E9DF;
  font-size: 16px;
  margin: 12px 0;
  overflow-wrap: anywhere;
}

.subtitle {
  color: #B8C2B6;
  font-size: 14px;
  line-height: 1.7;
  margin: 0 0 30px;
}

.auth-button,
.primary-button {
  width: 100%;
  min-height: 50px;
  border: none;
  background: #465B70;
  color: #F2F2EC;
  font-weight: 600;
  border-radius: 5px;
  transition: background 0.2s, transform 0.2s;
}

.auth-button:hover,
.primary-button:hover {
  background: #566D83;
  transform: translateY(-2px);
}

.google-icon {
  display: inline-block;
  margin-right: 12px;
  font-weight: 700;
  color: #E6E9DF;
}

.divider {
  display: flex;
  align-items: center;
  gap: 15px;
  margin: 23px 0;
  color: #A5B99F;
  font-size: 10px;
  letter-spacing: 2px;
}

.divider::before,
.divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: #66796B;
}

.email-form {
  display: flex;
  flex-direction: column;
  gap: 13px;
  margin-top: 22px;
}

.email-form label {
  color: #B8C9B2;
  font-size: 11px;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: -5px;
}

.channel-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0 0 4px;
}

.email-form .channel-option {
  display: flex;
  align-items: center;
  gap: 11px;
  margin: 0;
  padding: 13px 15px;
  border: 1px solid #526458;
  border-radius: 5px;
  background: #263440;
  color: #F2EDE5;
  font-size: 12px;
  letter-spacing: 0.3px;
  text-transform: none;
  cursor: pointer;
}

.email-form .channel-option:has(.channel-checkbox:checked) {
  border-color: #A5B99F;
  background: #2D4038;
}

.email-form .channel-checkbox {
  width: 17px;
  height: 17px;
  flex: 0 0 17px;
  margin: 0;
  padding: 0;
  accent-color: #A5B99F;
  cursor: pointer;
}

input,
textarea,
select {
  width: 100%;
  padding: 15px;
  border: 1px solid #526458;
  border-radius: 5px;
  outline: none;
  background: #263440;
  color: #F2EDE5;
}

input:focus,
textarea:focus,
select:focus {
  border-color: #A5B99F;
}

input::placeholder,
textarea::placeholder {
  color: #A6B0AA;
}

select {
  cursor: pointer;
}

.message-input {
  resize: vertical;
  min-height: 140px;
  line-height: 1.6;
}

.text-button {
  border: none;
  background: transparent;
  color: #B8C9B2;
  padding: 12px 0;
  font-size: 12px;
  text-decoration: underline;
  text-underline-offset: 4px;
}

.text-button:hover {
  color: #E6E9DF;
}

footer {
  margin-top: 45px;
  padding-top: 18px;
  border-top: 1px solid #607265;
  color: #A5B99F;
  font-family: 'Silkscreen', sans-serif;
  font-size: 9px;
  letter-spacing: 1px;
}

.error,
.success {
  padding: 12px;
  border-radius: 5px;
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.error {
  background: #583B3B;
  color: #FFD6D0;
}

.success {
  background: #2B4938;
  color: #C8E8C5;
}

.loading-screen {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #080B09;
  color: #A5B99F;
  font-family: 'Silkscreen', sans-serif;
}

.dashboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 40px;
}

.logout-button {
  background: transparent;
  border: 1px solid #829283;
  color: #D8E0D5;
  padding: 9px 13px;
  border-radius: 4px;
  font-size: 10px;
  letter-spacing: 1px;
}

.logout-button:hover {
  background: #465B70;
}

.user-email {
  color: #A5B99F;
  font-size: 12px;
  margin: -17px 0 25px;
  overflow-wrap: anywhere;
}

.options {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.option-button {
  display: flex;
  align-items: center;
  gap: 15px;
  width: 100%;
  text-align: left;
  padding: 20px;
  background: #35475B;
  border: 1px solid #586A7B;
  border-radius: 5px;
  color: #E6E9DF;
  transition: background 0.2s, transform 0.2s;
}

.option-button:hover {
  background: #465B70;
  transform: translateX(4px);
}

.option-number {
  font-family: 'Silkscreen', sans-serif;
  font-size: 10px;
  color: #A5B99F;
  white-space: nowrap;
}

.option-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.option-content strong {
  font-size: 14px;
}

.option-content small {
  color: #B8C2B6;
  font-size: 11px;
  line-height: 1.5;
}

.arrow {
  font-size: 20px;
  color: #A5B99F;
}

.admin-register-link {
  display: block;
  margin: 25px auto 0;
}

.admin-button {
  width: 100%;
  padding: 16px;
  margin-top: 25px;
  border: 1px solid #A5B99F;
  border-radius: 5px;
  background: #26372D;
  color: #D8E8D2;
  font-family: 'Silkscreen', sans-serif;
  font-size: 11px;
}

.admin-button:hover {
  background: #465B70;
}

.admin-secondary-button {
  display: block;
  width: 100%;
  padding: 13px;
  margin-top: 10px;
  border: 1px solid #829283;
  border-radius: 5px;
  background: transparent;
  color: #D8E0D5;
  font-size: 10px;
  letter-spacing: 1px;
}

.admin-secondary-button:hover {
  background: #465B70;
}

.subpage {
  min-height: 250px;
}

.subpage h1 {
  margin-top: 20px;
  font-size: clamp(19px, 4vw, 26px);
}

.subpage > .text-button {
  margin-top: 25px;
}

.inbox-count {
  color: #A5B99F;
  font-family: 'Silkscreen', sans-serif;
  font-size: 9px;
  margin-bottom: 15px;
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 13px;
  max-height: 540px;
  overflow-y: auto;
  padding-right: 4px;
}

.message-card {
  padding: 19px;
  background: #26372D;
  border: 1px solid #526458;
  border-radius: 5px;
}

.message-channel {
  display: inline-block;
  color: #A5B99F;
  font-family: 'Silkscreen', sans-serif;
  font-size: 9px;
  line-height: 1.8;
  margin-bottom: 8px;
}

.message-date {
  display: block;
  color: #A5B99F;
  font-size: 10px;
  margin: 7px 0 12px;
}

.message-body {
  color: #E6E9DF;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin: 12px 0;
}

.thread-button {
  width: 100%;
  padding: 12px;
  margin-top: 15px;
  border: 1px solid #829283;
  border-radius: 4px;
  background: transparent;
  color: #C8D8C2;
  font-size: 10px;
  letter-spacing: 1px;
}

.thread-button:hover {
  background: #394B40;
}

.reply-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 15px;
}

.reply-card {
  padding: 14px;
  background: #394B40;
  border-radius: 5px;
}

.reply-label {
  color: #A5B99F;
  font-family: 'Silkscreen', sans-serif;
  font-size: 8px;
}

.reply-card p {
  color: #E6E9DF;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.chat-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 360px;
  overflow-y: auto;
  margin-top: 16px;
  padding: 14px;
  background: #26372D;
  border: 1px solid #526458;
  border-radius: 6px;
}

.chat-message {
  width: fit-content;
  max-width: 88%;
  padding: 11px 13px;
  border-radius: 8px;
  color: #26372D;
  background: #DCE8D5;
  overflow-wrap: anywhere;
}

.student-chat-message {
  align-self: flex-end;
  background: #C8DCC0;
}

.admin-chat-message {
  align-self: flex-start;
  background: #E2EBDD;
}

.chat-sender {
  display: block;
  color: #526B54;
  font-family: 'Silkscreen', sans-serif;
  font-size: 8px;
  line-height: 1.7;
}

.chat-message p {
  margin: 5px 0;
  color: #26372D;
  font-size: 13px;
  line-height: 1.65;
  white-space: pre-wrap;
}

.chat-time {
  display: block;
  color: #61745F;
  font-size: 9px;
  text-align: right;
}

.chat-compose {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 13px;
}

.chat-compose textarea {
  width: 100%;
  resize: vertical;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid #829783;
  border-radius: 5px;
  outline: none;
  background: #E2EBDD;
  color: #26372D;
  font: inherit;
  font-size: 13px;
  line-height: 1.6;
}

.chat-compose textarea::placeholder {
  color: #71816F;
}

.chat-compose .primary-button {
  align-self: flex-end;
}

.no-replies {
  color: #B8C2B6;
  font-size: 12px;
}

.privacy-note {
  color: #B8C9B2;
  font-size: 11px;
  line-height: 1.6;
  margin: 0;
}

.inbox-empty {
  padding: 40px 20px;
  text-align: center;
  background: #26372D;
  border: 1px solid #526458;
  border-radius: 5px;
  color: #B8C2B6;
  font-size: 12px;
  line-height: 1.7;
}

.inbox-empty strong {
  display: block;
  color: #E6E9DF;
  font-size: 14px;
  margin-top: 10px;
}

.inbox-empty p {
  margin: 5px 0 0;
}

.empty-icon {
  font-size: 28px;
  color: #A5B99F;
}

/* MODALS */

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.78);
  overflow-y: auto;
}

.modal-card {
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 30px;
  background: #394b40;
  border: 1px solid #66796B;
  border-radius: 8px;
  box-shadow: 8px 8px 0 #202B24;
}

.modal-card h1 {
  margin-top: 15px;
}

.announcement-card {
  text-align: center;
}

.announcement-icon {
  width: 46px;
  height: 46px;
  margin: 22px auto;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #A5B99F;
  color: #26372D;
  font-family: 'Silkscreen', sans-serif;
  font-size: 22px;
}

.announcement-text {
  color: #E6E9DF;
  font-size: 14px;
  line-height: 1.8;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.dismiss-button {
  margin-top: 25px;
}

@media (max-width: 550px) {
  .login-card,
  .dashboard-card {
    padding: 30px 23px;
  }

  .resizable-card {
    min-width: min(320px, calc(100vw - 36px));
    min-height: 320px;
  }

  .role-label {
    font-size: 10px;
  }

  .option-button {
    padding: 16px 12px;
    gap: 10px;
  }

  .option-number {
    font-size: 8px;
  }


  .option-content strong {
    font-size: 12px;
  }

  .option-content small {
    font-size: 10px;
  }

  .message-card {
    padding: 15px;
  }

  .modal-card {
    padding: 24px 19px;
  }
}
`;

export default App;