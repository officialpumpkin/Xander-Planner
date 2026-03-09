Xander's Sleep & Feed Planner 👶💤🍼

A real-time, mobile-first React web application designed to help parents track their newborn's sleep cycles and feeding windows. It calculates the optimal wake windows based on 45-minute sleep blocks to perfectly align with 2-hour and 3-hour feeding schedules.

✨ Features

Live Sync: Built with Firebase Firestore so both parents can view and update the tracker in real-time on their respective phones.

Smart Wake Windows: Automatically calculates the optimal time to wake the baby by finding the 45-minute sleep cycle that ends closest to the next feed due time.

Cycle Tracking: Displays upcoming 45-minute sleep cycle milestones so you know when the baby is likely to transition or stir.

Feed Deadlines: Tracks 2-hour and 3-hour feed windows based on the start time of the last feed.

Editable Logs: Forgot to hit the button? Easily edit the start time for sleeps and feeds with a native mobile time picker.

Mobile-First UI: Beautifully designed with Tailwind CSS to look and feel like a native iOS/Android app when added to the home screen.

Google Authentication: Securely log in using your Google account to access your family's data.

🛠 Tech Stack

Frontend: React (Vite)

Styling: Tailwind CSS, Lucide React (Icons)

Backend/Database: Firebase Authentication, Cloud Firestore

Deployment: Firebase Hosting via GitHub Actions
