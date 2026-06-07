export interface Messages {
  nav: {
    home: string; students: string; mark: string; fees: string; more: string;
    dashboard: string; attendance: string; exams: string; timetable: string;
    homework: string; notices: string; admissions: string; communications: string; settings: string;
  };
  common: {
    save: string; cancel: string; delete: string; edit: string; add: string; search: string;
    loading: string; saving: string; saved: string; error: string; retry: string;
    yes: string; no: string; submit: string; back: string; next: string; done: string;
    close: string; open: string; today: string; yesterday: string;
    offline: string; online: string; signOut: string; signIn: string; language: string;
  };
  dashboard: {
    morning: string; afternoon: string; evening: string;
    actionNeeded: string; quickActions: string;
    activeStudents: string; collected: string; hotLeads: string;
    overdueFees: string; classesUnmarked: string; feeTrend: string;
  };
  attendance: {
    present: string; absent: string; late: string; halfDay: string;
    copyYesterday: string; markRestPresent: string; unmarked: string; update: string;
    notifyAbsentees: string; whatsapp: string; sent: string;
  };
  fees: {
    paid: string; partial: string; unpaid: string; overdue: string; outstanding: string;
    pay: string; payNow: string; remindOverdue: string; remindMonth: string;
  };
  parent: {
    welcome: string; yourChildren: string; switchChild: string;
    attendanceMonth: string; homework: string; notices: string; paymentSoon: string;
    enterPhone: string; enterOtp: string; sendOtp: string; verifyOtp: string;
    otpSent: string; invalidOtp: string; noChildren: string; phoneAuthDisabled: string;
  };
  settings: {
    institution: string; team: string; classes: string; language: string;
    notifications: string; enableNotifications: string;
    notificationsBlocked: string; notificationsEnabled: string;
    notificationsNotSupported: string; pushNotConfigured: string;
  };
}

export const en: Messages = {
  nav: {
    home: "Home", students: "Students", mark: "Mark", fees: "Fees", more: "More",
    dashboard: "Dashboard", attendance: "Attendance", exams: "Exams", timetable: "Timetable",
    homework: "Homework", notices: "Notices", admissions: "Admissions", communications: "Communications", settings: "Settings",
  },
  common: {
    save: "Save", cancel: "Cancel", delete: "Delete", edit: "Edit", add: "Add", search: "Search",
    loading: "Loading…", saving: "Saving…", saved: "Saved", error: "Something went wrong", retry: "Retry",
    yes: "Yes", no: "No", submit: "Submit", back: "Back", next: "Next", done: "Done",
    close: "Close", open: "Open", today: "Today", yesterday: "Yesterday",
    offline: "You are offline. Showing cached data.", online: "Back online",
    signOut: "Sign out", signIn: "Sign in", language: "Language",
  },
  dashboard: {
    morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening",
    actionNeeded: "Action needed", quickActions: "Quick actions",
    activeStudents: "Active students", collected: "Collected this month", hotLeads: "Hot leads",
    overdueFees: "Overdue fees", classesUnmarked: "Classes unmarked", feeTrend: "Fee collection trend",
  },
  attendance: {
    present: "Present", absent: "Absent", late: "Late", halfDay: "Half day",
    copyYesterday: "Copy yesterday", markRestPresent: "Mark rest present", unmarked: "unmarked", update: "Update",
    notifyAbsentees: "Notify absentees", whatsapp: "WhatsApp", sent: "Sent",
  },
  fees: {
    paid: "Paid", partial: "Partial", unpaid: "Unpaid", overdue: "Overdue", outstanding: "Outstanding",
    pay: "Pay", payNow: "Pay now", remindOverdue: "Remind overdue", remindMonth: "Remind all this month",
  },
  parent: {
    welcome: "Welcome", yourChildren: "Your children", switchChild: "Switch child",
    attendanceMonth: "Attendance this month", homework: "Homework", notices: "Notices",
    paymentSoon: "Online payment via Razorpay coming soon. Please contact the school for now.",
    enterPhone: "Enter your mobile number", enterOtp: "Enter the OTP",
    sendOtp: "Send OTP", verifyOtp: "Verify",
    otpSent: "OTP sent to {phone}", invalidOtp: "Invalid or expired OTP",
    noChildren: "No children linked to this number. Please contact your school.",
    phoneAuthDisabled: "OTP login is not configured. Please use your private portal link from school WhatsApp.",
  },
  settings: {
    institution: "Institution", team: "Team", classes: "Classes", language: "Language",
    notifications: "Notifications", enableNotifications: "Enable push notifications",
    notificationsBlocked: "Notifications are blocked. Allow in browser settings.",
    notificationsEnabled: "Notifications enabled",
    notificationsNotSupported: "Notifications not supported on this device.",
    pushNotConfigured: "Push notifications are not configured on this server.",
  },
};
