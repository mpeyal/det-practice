import React, { useState } from 'react'
import Home from './screens/Home.jsx'
import ExamLobby from './screens/ExamLobby.jsx'
import ExamRunner from './screens/ExamRunner.jsx'
import PracticeMenu from './screens/PracticeMenu.jsx'
import PracticeSets from './screens/PracticeSets.jsx'
import PracticeRunner from './screens/PracticeRunner.jsx'
import Review from './screens/Review.jsx'
import Settings from './screens/Settings.jsx'
import { assembleExam, assemblePractice, assembleSkillPractice, TYPE_LABELS } from './lib/exam.js'

/**
 * Tiny state-machine router (no URL routing — keeps the app working
 * identically from file:// and as an installed PWA).
 */
export default function App() {
  const [screen, setScreen] = useState({ name: 'home' })
  const go = (next) => { window.scrollTo(0, 0); setScreen(next) }

  let content = null
  switch (screen.name) {
    case 'home':
      content = <Home go={go} />
      break
    case 'settings':
      content = <Settings go={go} />
      break
    case 'lobby':
      content = <ExamLobby go={go} />
      break
    case 'exam': {
      const exam = screen.exam || assembleExam(screen.examNo)
      content = (
        <ExamRunner
          exam={exam}
          onQuit={() => confirm('Quit the exam? Progress will be lost.') && go({ name: 'home' })}
          onFinish={(items, responses) => go({ name: 'review', title: `Full Exam #${exam.examNo}`, items, responses })}
        />
      )
      break
    }
    case 'practice-menu':
      content = <PracticeMenu go={go} />
      break
    case 'practice-sets':
      content = <PracticeSets go={go} type={screen.type} skill={screen.skill} timed={screen.timed} />
      break
    case 'practice': {
      if (!screen.items) {
        const built = screen.skill
          ? assembleSkillPractice(screen.skill, screen.setNo)
          : assemblePractice(screen.type, 5, screen.setNo)
        const base = screen.skill ? `${screen.skill[0].toUpperCase()}${screen.skill.slice(1)} practice` : TYPE_LABELS[screen.type]
        const title = screen.setNo ? `${base} · Set #${screen.setNo}` : `${base} · random`
        // stash items in state so a re-render doesn't rebuild them
        setScreen({ ...screen, items: built.items, title })
        break
      }
      content = (
        <PracticeRunner
          title={screen.title}
          items={screen.items}
          timed={screen.timed}
          onQuit={() => go({ name: 'practice-menu' })}
          onFinishAll={(items, responses) => go({ name: 'review', title: `${screen.title} (practice)`, items, responses })}
        />
      )
      break
    }
    case 'review': {
      const h = screen.history // a saved attempt, re-opened from Recent results
      content = (
        <Review
          title={h ? h.title : screen.title}
          items={h ? h.items : screen.items}
          responses={h ? h.responses : screen.responses}
          history={!!h}
          attemptId={h ? h.id : undefined}
          savedSubjectiveScores={h ? h.subjectiveScores : undefined}
          savedSubjectiveResults={h ? h.subjectiveResults : undefined}
          onHome={() => go({ name: 'home' })}
        />
      )
      break
    }
    default:
      content = <Home go={go} />
  }

  return <div className="min-h-full px-4 py-6 sm:py-10">{content}</div>
}
