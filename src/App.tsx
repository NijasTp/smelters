import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Signup } from './pages/Signup';
import { Feed } from './pages/Feed';
import { Profile } from './pages/Profile';
import { AcceptInvite } from './pages/AcceptInvite';
import { DiaryEditor } from './components/DiaryEditor';
import { DiaryViewer } from './components/DiaryViewer';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen relative font-body selection:bg-primary-pink/20 py-4 px-2 md:py-10">
          {/* Main Content Container - Clean Soft Shell */}
          <div className="relative z-10 glass-card max-w-2xl mx-auto min-h-[90vh] flex flex-col overflow-hidden">
            <main className="flex-1 p-4 md:p-8 flex flex-col relative w-full">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/profile/:username" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/invite/:token" element={<ProtectedRoute><AcceptInvite /></ProtectedRoute>} />
                <Route path="/diary/new" element={<ProtectedRoute><DiaryEditor /></ProtectedRoute>} />
                <Route path="/diary/:id" element={<ProtectedRoute><DiaryViewer /></ProtectedRoute>} />
              </Routes>
            </main>
          </div>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
