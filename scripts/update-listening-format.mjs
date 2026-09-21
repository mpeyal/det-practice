// Migrate the original practice bank to scenario-only listening plus five replies.
import { readFileSync, writeFileSync } from 'node:fs'
const path = new URL('../src/data/conversations.json', import.meta.url)
const bank = JSON.parse(readFileSync(path, 'utf8'))
const additions = [
  ['You have been ill this week. Your essay is due on Friday, and you would like three extra days to finish it. You are meeting your professor to discuss an extension.', ['ill', 'Friday', 'three'], ['You have been', 'Your essay is due on', 'You would like this many extra days:'],
    ['Please include your course number in the email so the office can find your record.', 'I will include the course number and the new deadline.', 'I will send just my name and leave out the course information.', 'I will ask the office to choose a different course for me.'],
    ['That is everything. If you are still unwell on Monday, let me know before the deadline.', 'I will contact you before Monday’s deadline if I need further advice.', 'I will wait until after the deadline to mention any problems.', 'I will assume another extension is automatic.']],
  ['You are planning next semester with your academic advisor. You have chosen two courses and need a third. Your degree still requires a writing course and a science elective.', ['two', 'third', 'writing'], ['You have already chosen this many courses:', 'You need help choosing your', 'One remaining requirement is a course in'],
    ['Before registering, check that the writing seminar does not clash with your other classes.', 'I will compare the seminar time with my existing schedule.', 'I will register without checking because required courses cannot overlap.', 'I will cancel my other classes immediately.'],
    ['If it is full, join the waiting list and email me. We can discuss a backup.', 'I will join the waiting list and contact you about another option.', 'I will give up on completing the requirement.', 'I will attend without registering or telling anyone.']],
  ['You are working on a research project about ocean pollution. You need a book from the university library, but you cannot find it on the shelf. You are asking a librarian for help.', ['ocean pollution', 'book', 'librarian'], ['Your research topic is', 'You cannot find a', 'You are asking a'],
    ['Sign in to the library website with your student account and search the title.', 'I will use my student account to find the online book.', 'I will create a new shopping account to buy the book.', 'I will search the shelves again instead of signing in.'],
    ['The online version is available now. We will also email you when the printed copy returns.', 'Thank you. I can start reading online while I wait for the printed copy.', 'Please cancel the online version until the printed book returns.', 'I will wait for your email before starting any research.']],
  ['You and a classmate need to prepare a history presentation. You want to arrange a meeting after Wednesday’s lecture. You have not yet decided how to divide the work.', ['history', 'Wednesday', 'classmate'], ['Your presentation is for', 'You suggest meeting after the lecture on', 'You are working with a'],
    ['Could we each bring two reliable sources to support our part?', 'Yes, I will find two sources for my section before we meet.', 'I will leave the sources for you to find for both sections.', 'We should avoid sources because they make presentations longer.'],
    ['Perfect. After comparing our notes, we can rehearse the whole presentation.', 'That sounds useful. We can also check how long it takes.', 'Let us rehearse separately and never compare our notes.', 'We should skip rehearsal if our sources are reliable.']],
  ['You are visiting the campus health clinic. You have had a sore throat and a dry cough for five days. You want to ask a doctor how to manage your symptoms.', ['clinic', 'five', 'dry cough'], ['You are visiting the campus health', 'Your symptoms began this many days ago:', 'Along with a sore throat, you have a'],
    ['Yes. If it lasts more than ten days, please make another appointment.', 'I will book another appointment if the symptoms last that long.', 'I will wait another month before asking for help.', 'I will assume I need antibiotics immediately.'],
    ['Do you need a note for the classes you missed?', 'Yes, please. I missed two classes and need to explain my absence.', 'Please write that I attended every class this week.', 'I would like you to change my grades instead.']],
  ['You rent an apartment and the kitchen tap has been leaking since yesterday. The leak is getting worse. You are calling your landlord to arrange a repair.', ['kitchen', 'yesterday', 'landlord'], ['The leaking tap is in the', 'The leak began', 'You are calling your'],
    ['Until then, place a bucket under the pipe and move your belongings away from the water.', 'I will put a bucket there and clear the area now.', 'I will leave my belongings under the leaking pipe.', 'I will try to replace the pipe myself tonight.'],
    ['The plumber may need access to the cupboard under the sink. Could you empty it?', 'Of course. I will clear the cupboard before nine tomorrow.', 'I will lock the cupboard to keep everything safe.', 'I will ask the plumber to work without opening it.']],
  ['You bought a jacket last weekend at a clothing shop, but it is too small. You have brought the jacket and your receipt back to the shop to discuss your options.', ['jacket', 'small', 'receipt'], ['You are returning a', 'It is too', 'You have brought your proof of purchase, the'],
    ['We have a medium in the same color. Would you like to try it on first?', 'Yes, I would like to check the fit before exchanging it.', 'No, I want another small even though it does not fit.', 'Please exchange it for a different item without showing me.'],
    ['How does that one fit?', 'It fits comfortably. I would like to exchange the original jacket for this one.', 'I have not tried it on, but please say it fits.', 'I would like to return the receipt and keep both jackets.']],
  ['Your cousin is getting married on Saturday, when you are scheduled to work. You are asking a coworker about covering that shift. You are willing to exchange shifts rather than simply miss work.', ['cousin', 'Saturday', 'coworker'], ['The person getting married is your', 'Your scheduled shift is on', 'You are asking a'],
    ['The manager usually needs both of us to confirm the exact times.', 'I will include both shift times in my message.', 'I will leave out the times so we can decide later.', 'I will confirm only your shift and ignore mine.'],
    ['Once the manager approves, I will put the change on the shared calendar.', 'Thanks. I will check the calendar after we receive approval.', 'I will assume the swap is approved before the manager replies.', 'Let us keep the change off the calendar.']],
  ['You are choosing a topic for a ten-page final paper. You are interested in renewable energy but think it may be too broad. You are meeting your professor to discuss a narrower focus.', ['ten', 'renewable energy', 'professor'], ['Your final paper should be this many pages:', 'Your broad area of interest is', 'You are meeting your'],
    ['Start with the university research database and use filters for peer-reviewed articles.', 'I will search there and filter for peer-reviewed sources.', 'I will rely only on social media posts.', 'I will remove the academic filters to avoid journal articles.'],
    ['Bring a short outline next week so we can check that your argument is focused.', 'I will prepare an outline showing my main argument and supporting points.', 'I will bring only a list of unrelated topics.', 'I will wait until the final deadline to choose an argument.']],
  ['You missed a lecture because you had a bad cold. A quiz is coming up, and you want to catch up on the material. You are asking a classmate to share their notes.', ['cold', 'quiz', 'notes'], ['You missed class because you had a bad', 'You need to prepare for a', 'You want your classmate to share their'],
    ['There was also a diagram on the board. I drew it at the bottom of the second page.', 'I will look for the diagram on the second page.', 'I will ignore the second page because diagrams cannot help.', 'I will assume the diagram is on the first page.'],
    ['If anything is unclear, we could review together tomorrow before class.', 'That would help. I will read the notes first and bring my questions.', 'Please explain everything before I look at the notes.', 'I will skip the quiz rather than review.']],
  ['You are interested in a summer internship in marketing. You completed a statistics project last term and want to discuss applications with your advisor. You hope to work on real campaigns.', ['summer', 'marketing', 'statistics'], ['You want an internship during the', 'Your preferred field is', 'Last term, you completed a project in'],
    ['Tailor your cover letter to each company rather than sending exactly the same one.', 'I will explain how my experience relates to each company’s work.', 'I will send the same letter without reading about the companies.', 'I will leave the company name out of every application.'],
    ['Send me a draft of your resume when it is ready, and I can give you feedback.', 'Thank you. I will update it this week and send you a draft.', 'I will submit it everywhere before making any updates.', 'Please write my entire application without seeing my experience.']],
  ['You and a coworker are preparing a client presentation for Thursday. It needs to cover the budget and the project timeline. You are meeting to divide those sections and arrange a rehearsal.', ['Thursday', 'budget', 'timeline'], ['Your client presentation is on', 'One section covers the', 'The other section covers the project'],
    ['Could you also bring a digital copy in case we need to change the timeline?', 'Yes, I will bring an editable version as well as the printed handouts.', 'I will delete the digital file after printing.', 'I will bring only an old version that cannot be edited.'],
    ['Great. Let us leave ten minutes at the end of rehearsal for possible client questions.', 'Good idea. We can prepare answers to the questions they are most likely to ask.', 'We should use all the time on slides and ignore questions.', 'I will tell the client not to ask any questions.']],
]
// Replace the original doctor's office / rental / shop roleplays with
// university interactions, matching the official academic scenarios.
const replacements = [
  [4, 'Professor', 'You missed five days of classes because of a cold. You are now meeting your professor to ask how to catch up before the next quiz.', ['five','cold','quiz'], ['You missed this many days of classes:', 'You were absent because of a', 'You need to catch up before the next'],
    ['Welcome back. How can I help you catch up?', 'I missed five days because I had a cold. Could we discuss what I should study first?'],
    ['Start with the notes for chapters three and four. Have you managed to get them?', 'Not yet. I will ask a classmate for the notes today.'],
    ['Good. Then attempt the practice questions online. They will show you which topics need more work.', 'I will work through those questions after reading the notes.'],
    ['Bring any questions you cannot solve to my office hours on Tuesday.', 'I will try them first and bring the difficult ones on Tuesday.'],
    ['That should prepare you for Friday. Let me know if you are still struggling after office hours.', 'Thank you. I will follow that plan and let you know how it goes.']],
  [5, 'Classmate', 'You and a classmate are preparing a laboratory report. Your measurements do not match, and the report is due tomorrow. You want to compare your notes before writing the results.', ['laboratory report','measurements','tomorrow'], ['You are preparing a', 'You need to compare your', 'The report is due'],
    ['You said there was a problem with our results. What did you notice?', 'Our measurements are different. Could we compare the notes from the experiment?'],
    ['Of course. I wrote the temperatures in Celsius. What units did you use?', 'I used Fahrenheit. That might explain why the numbers looked different.'],
    ['Let us convert them to the same unit before deciding whether we need to repeat anything.', 'Agreed. I will convert mine to Celsius and then compare them with yours.'],
    ['The converted measurements match closely. Could you update the results table?', 'Yes, I will label the units clearly and update the table.'],
    ['Great. I will check the calculations tonight, and we can submit tomorrow morning.', 'That works. I will send you the revised table this afternoon.']],
  [6, 'Classmate', 'You borrowed a jacket from a classmate for a university debate last weekend. You want to return it, but you noticed a loose button. You are talking to your classmate about repairing it.', ['jacket','debate','button'], ['You borrowed a', 'You wore it for a university', 'You noticed a loose'],
    ['How did the debate go? Did the jacket fit?', 'It fitted well, thank you. I noticed a loose button and wanted to ask about fixing it.'],
    ['Thanks for telling me. Is the button still attached?', 'Yes, but the thread is coming loose. I kept the jacket safe so the button would not fall off.'],
    ['I have matching thread at home. Could you bring the jacket tomorrow?', 'Certainly. I can bring it before our morning lecture.'],
    ['That would be fine. It should only take a few minutes to sew it back on.', 'Thanks. I can help if you show me what to do.'],
    ['No problem. I am glad you told me before it came off completely.', 'I appreciate you lending it to me. I will see you tomorrow morning.']],
]
for (const [i,partner,scenario,answers,prefixes,...turns] of replacements) {
  additions[i] = [scenario,answers,prefixes,...turns.slice(3).map(([audio,answer])=>[audio,answer,'I will leave that until after the deadline.','I think we should ignore that issue.'])]
  const make = ([audio,answer])=>({audio,prompt:'Select the best response',answer,options:[answer,'Could we change the subject?','I do not think I need to do anything about that.','I will ask you about something unrelated instead.'],explanation:'This reply responds to the question and helps resolve the situation.'})
  bank[i].partner=partner
  bank[i].opener=make(turns[0]); bank[i].rounds=turns.slice(1,3).map(make)
  bank[i].dialogue=[{speaker:'partner',text:turns[0][0]}]
}
// The shift swap is between student coworkers; the presentation is coursework.
bank[7].partner='Classmate'
additions[7][0]='You work at the campus cafe with a classmate. Your cousin is getting married on Saturday, when you are scheduled to work. You are asking your classmate to exchange shifts.'
additions[7][1][2]='classmate'
bank[11].partner='Classmate'
additions[11][0]='You and a classmate are preparing a project presentation for Thursday. It needs to cover the budget and the project timeline. You are meeting to divide those sections and arrange a rehearsal.'
additions[11][2][0]='Your project presentation is on'
for (const [i,c] of bank.entries()) {
  const [scenario, answers, prefixes, ...extra] = additions[i]
  c.scenario = scenario
  c.comprehension = answers.map((answer,j) => ({ q: 'Complete the sentence based on the scenario.', pre: prefixes[j], post: '', answer, alts: ({ill:['sick','unwell'],three:['3'],two:['2'],five:['5'],ten:['10'],third:['3rd'],Wednesday:['Wednesday afternoon'],clinic:['health clinic']})[answer] || [] }))
  const frames = [
    [['You have been','this week.'],['Your essay is due on','.'],['You would like','extra days to finish.']],
    [['You have already chosen','courses.'],['You need help choosing your','course.'],['One remaining requirement is a','course.']],
    [['Your research project is about','.'],['You cannot find a','on the shelf.'],['You are asking a','for help.']],
    [['You are preparing a','presentation.'],['You suggest meeting after the lecture on','.'],['You are working with a','.']],
    [['You missed','days of classes.'],['You were absent because you had a','.'],['You need to catch up before the next','.']],
    [['You are preparing a','.'],['You need to compare your','.'],['The report is due','.']],
    [['You borrowed a','from a classmate.'],['You wore it for a university','.'],['You noticed a loose','.']],
    [['The person getting married is your','.'],['Your scheduled shift is on','.'],['You are asking a','to exchange shifts.']],
    [['Your final paper should be','pages long.'],['Your broad area of interest is','.'],['You are meeting your','to narrow the topic.']],
    [['You missed class because you had a bad','.'],['You need to prepare for a','.'],['You want your classmate to share their','.']],
    [['You want an internship during the','.'],['Your preferred field is','.'],['Last term, you completed a project in','.']],
    [['Your project presentation is on','.'],['One section covers the','.'],['The other section covers the project','.']],
  ]
  c.comprehension.forEach((q,j)=>{ [q.pre,q.post]=frames[i][j] })
  c.opener.audio = c.dialogue[0].text
  c.rounds = c.rounds.slice(0,2).concat(extra.map(([audio,answer,...wrong]) => ({audio,prompt:'Select the best response',options:[answer,...wrong,'Could we discuss a different subject instead?'],answer,explanation:'This reply addresses the speaker’s request and advances the conversation.'})))
  // Rotate correct answers so position does not give away the answer.
  for (const [j,q] of [c.opener,...c.rounds].entries()) { q.options=[q.answer,...q.options.filter(o=>o!==q.answer)]; const offset=(i+j+1)%q.options.length; q.options=q.options.slice(offset).concat(q.options.slice(0,offset)) }
  c.dialogue = [c.opener,...c.rounds].flatMap(q => [{speaker:'partner',text:q.audio},{speaker:'you',text:q.answer}])
}
writeFileSync(path, JSON.stringify(bank,null,2)+'\n')
