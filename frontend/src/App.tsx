import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import Home from './pages/Home'
import Graveyard from './pages/Graveyard'
import PromptBattle from './pages/PromptBattle'
import PromptBattleLogin from './pages/PromptBattleLogin'
import PromptBattleRoom from './pages/PromptBattleRoom'
import { PromptBattleGuard } from './components/PromptBattleGuard'
import Confession from './pages/Confession'
import ConfessionBooth from './pages/ConfessionBooth'
import VoidPage from './pages/Void'
import TheVoid from './pages/TheVoid'
import Oracle from './pages/Oracle'
import InternetOracle from './pages/InternetOracle'
import TimeCapsule from './pages/TimeCapsule'
import Apology from './pages/Apology'
import Compliments from './pages/Compliments'
import DreamArchive from './pages/DreamArchive'
import MoodMirror from './pages/MoodMirror'
import Admin from './pages/Admin'
import Leaderboard from './pages/Leaderboard'
import Replays from './pages/Replays'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/graveyard" element={<Graveyard />} />
        <Route path="/prompt-battle/login" element={<PromptBattleLogin />} />
        <Route path="/prompt-battle/room" element={<PromptBattleGuard><PromptBattleRoom /></PromptBattleGuard>} />
        <Route path="/prompt-battle/room/:id" element={<PromptBattleGuard><PromptBattleRoom /></PromptBattleGuard>} />
        <Route path="/prompt-battle" element={<PromptBattleGuard><PromptBattle /></PromptBattleGuard>} />
        <Route path="/confession" element={<Confession />} />
        <Route path="/rooms/confession-booth" element={<ConfessionBooth />} />
        <Route path="/void" element={<VoidPage />} />
        <Route path="/rooms/the-void" element={<TheVoid />} />
        <Route path="/oracle" element={<Oracle />} />
        <Route path="/rooms/internet-oracle" element={<InternetOracle />} />
        <Route path="/timecapsule" element={<TimeCapsule />} />
        <Route path="/apology" element={<Apology />} />
        <Route path="/compliments" element={<Compliments />} />
        <Route path="/dreams" element={<DreamArchive />} />
        <Route path="/mood-mirror" element={<MoodMirror />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/replays" element={<Replays />} />
      </Routes>
    </Layout>
  )
}
