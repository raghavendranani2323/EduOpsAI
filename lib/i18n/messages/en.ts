export interface Messages {
  nav: {
    home: string; students: string; classes: string; mark: string; fees: string; more: string;
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
    disableNotifications: string;
    notificationsBlocked: string; notificationsEnabled: string;
    notificationsNotSupported: string; pushNotConfigured: string;
  };
  more: {
    title: string;
    admissionsDesc: string; examsDesc: string; timetableDesc: string; homeworkDesc: string;
    noticesDesc: string; communicationsDesc: string; settingsDesc: string;
  };
  settingsPage: {
    title: string;
    academicYear: string; academicYearDesc: string;
    teamInvitations: string; teamInvitationsDesc: string;
    classesBatches: string; classesBatchesDesc: string;
    institutionProfile: string; institutionProfileDesc: string;
    notifications: string; notificationsDesc: string;
    exportData: string; exportDataDesc: string;
    auditLog: string; auditLogDesc: string;
    signOutDesc: string;
  };
  exportPage: {
    title: string; description: string;
    students: string; studentsDesc: string;
    feeInvoices: string; feeInvoicesDesc: string;
    attendance: string; attendanceDesc: string;
    filterByMonth: string; appendMonth: string; privacy: string;
  };
  studentForm: {
    student: string; class: string; title: string; intro: string; basics: string; fullName: string; admissionNo: string;
    gender: string; select: string; male: string; female: string; other: string;
    dob: string; guardian: string; guardianName: string; phone: string; relation: string;
    tags: string; guardianHelp: string; cancel: string; saving: string; save: string;
    added: string; failed: string; fullNameRequired: string; guardianPhoneRequired: string; guardianNameRequired: string;
    father: string; mother: string; guardianRelation: string; grandfather: string; grandmother: string; otherRelation: string;
  };
}

export const en: Messages = {
  nav: {
    home: "Home", students: "Students", classes: "Classes", mark: "Mark", fees: "Fees", more: "More",
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
    notifications: "Notifications", enableNotifications: "Enable push notifications", disableNotifications: "Turn off notifications",
    notificationsBlocked: "Notifications are blocked. Allow in browser settings.",
    notificationsEnabled: "Notifications enabled",
    notificationsNotSupported: "Notifications not supported on this device.",
    pushNotConfigured: "Push notifications are not configured on this server.",
  },
  more: {
    title: "More",
    admissionsDesc: "Leads pipeline",
    examsDesc: "Marks & results",
    timetableDesc: "Class schedule",
    homeworkDesc: "Assignments",
    noticesDesc: "Notice board",
    communicationsDesc: "Templates & messages",
    settingsDesc: "Team & institution",
  },
  settingsPage: {
    title: "Settings",
    academicYear: "Academic year",
    academicYearDesc: "Set the current academic year",
    teamInvitations: "Team & Invitations",
    teamInvitationsDesc: "Invite staff and manage roles",
    classesBatches: "Classes / Batches",
    classesBatchesDesc: "Manage your classes",
    institutionProfile: "Institution profile",
    institutionProfileDesc: "Update institution details",
    notifications: "Notifications",
    notificationsDesc: "Push & WhatsApp preferences",
    exportData: "Export data",
    exportDataDesc: "Download students, fees, attendance as CSV",
    auditLog: "Audit log",
    auditLogDesc: "Who did what, when",
    signOutDesc: "End this session on this device",
  },
  exportPage: {
    title: "Export data",
    description: "Download CSV files openable in Excel, Google Sheets, or any tool. UTF-8 encoded.",
    students: "Students",
    studentsDesc: "Full student roster with admission no., class, primary guardian and phone.",
    feeInvoices: "Fee invoices",
    feeInvoicesDesc: "All invoices with status, paid amount and outstanding balance. Filterable by month.",
    attendance: "Attendance",
    attendanceDesc: "Day-by-day attendance records. Append ?month=YYYY-MM&classId=... to filter.",
    filterByMonth: "Filter by month",
    appendMonth: "Append ?month=2026-06 to the URL.",
    privacy: "All exports are scoped to your institution. Personal information is included only for staff who already have access - the same data they see on screen, just in spreadsheet form.",
  },
  studentForm: {
    student: "student",
    class: "Class",
    title: "New {student}",
    intro: "Add basic info - you can edit details later.",
    basics: "Basics",
    fullName: "Full name *",
    admissionNo: "Admission no.",
    gender: "Gender",
    select: "Select",
    male: "Male",
    female: "Female",
    other: "Other",
    dob: "Date of birth",
    guardian: "Primary guardian",
    guardianName: "Guardian name",
    phone: "Phone",
    relation: "Relation",
    tags: "Tags",
    guardianHelp: "Guardians are used for fee reminders, sibling discounts and parent login. Add more later from the student page.",
    cancel: "Cancel",
    saving: "Saving...",
    save: "Save student",
    added: "{name} added",
    failed: "Failed",
    fullNameRequired: "Full name is required",
    guardianPhoneRequired: "Guardian phone is required when guardian name is entered",
    guardianNameRequired: "Guardian name is required when phone is entered",
    father: "Father",
    mother: "Mother",
    guardianRelation: "Guardian",
    grandfather: "Grandfather",
    grandmother: "Grandmother",
    otherRelation: "Other",
  },
};
