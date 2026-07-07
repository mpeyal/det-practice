#!/usr/bin/env python3
"""
Rebuild conversations.json into the CURRENT Duolingo English Test
Interactive Listening format:

  Part A - Listen & comprehend:
     * hear the whole scenario conversation
     * fill in short comprehension blanks about what you heard
  Part B - Participate in the conversation:
     * pick the best option to START the conversation
     * then, each turn: hear the other speaker (audio plays once) and
       SELECT the best response  (with right/wrong + best-answer feedback)

The existing hand-written turns (partner lines + the correct `answer` for each
choice) already encode a good dialogue, so we transform them and add authored
comprehension questions.  Output schema per conversation:

  { id, scenario, partner, you,
    dialogue:      [ {speaker:'partner'|'you', text} ],   # Part A audio
    comprehension: [ {q, pre, post, answer, alts:[...] } ],
    opener:        { prompt, options:[...], answer, explanation },
    rounds:        [ {audio, prompt, options:[...], answer, explanation} ] }
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'src' / 'data' / 'conversations.json'

# Authored comprehension blanks (3 per conversation), based on each dialogue.
COMP = {
 'il1': [
   {'q':'Why do you need an extension?','pre':'I have been','post':'this week.','answer':'ill','alts':['sick','unwell']},
   {'q':'How many extra days do you ask for?','pre':'I ask for','post':'extra days.','answer':'three','alts':['3']},
   {'q':'What must you do to make it official?','pre':'I must','post':'the student office.','answer':'email','alts':['e-mail','message','contact']},
 ],
 'il2': [
   {'q':'How many courses have you already chosen?','pre':'I have already picked','post':'courses.','answer':'two','alts':['2']},
   {'q':'Which course will you take now?','pre':'I will take the','post':'course now.','answer':'writing','alts':['academic writing']},
   {'q':'Why should you register early?','pre':'The writing course','post':'up quickly.','answer':'fills','alts':['fills']},
 ],
 'il3': [
   {'q':'What is the book about?','pre':'The book is about ocean','post':'.','answer':'pollution','alts':[]},
   {'q':'Why can’t you take the book today?','pre':'The library’s copy is checked','post':'.','answer':'out','alts':['out']},
   {'q':'What can you read for free meanwhile?','pre':'I can read the','post':'version online.','answer':'electronic','alts':['digital','online']},
 ],
 'il4': [
   {'q':'What are you meeting about?','pre':'We are meeting about the','post':'presentation.','answer':'history','alts':[]},
   {'q':'What time will you meet?','pre':'We will meet at','post':'o’clock.','answer':'six','alts':['6','6pm']},
   {'q':'How will you divide the work?','pre':'Each of us will prepare','post':'of the topic.','answer':'half','alts':['a half']},
 ],
 'il5': [
   {'q':'How long have you had symptoms?','pre':'I have had symptoms for about','post':'days.','answer':'five','alts':['5']},
   {'q':'What does the doctor recommend?','pre':'The doctor recommends rest and warm','post':'.','answer':'fluids','alts':['liquids','drinks']},
   {'q':'When should you return?','pre':'I should return if it lasts beyond','post':'days.','answer':'ten','alts':['10']},
 ],
 'il6': [
   {'q':'What is the problem?','pre':'The kitchen','post':'is leaking.','answer':'tap','alts':['faucet','sink']},
   {'q':'When will the plumber come?','pre':'The plumber will come tomorrow','post':'.','answer':'morning','alts':[]},
   {'q':'What should you do tonight?','pre':'I should put a','post':'under the pipe.','answer':'bucket','alts':['pot','container']},
 ],
 'il7': [
   {'q':'Why are you returning the jacket?','pre':'The jacket is too','post':'.','answer':'small','alts':['tight']},
   {'q':'How did you pay?','pre':'I paid by','post':'.','answer':'card','alts':['credit card','debit card']},
   {'q':'What do you decide to do?','pre':'I decide to','post':'it for a larger size.','answer':'exchange','alts':['swap']},
 ],
 'il8': [
   {'q':'Why do you need Saturday off?','pre':'My cousin is getting','post':'that day.','answer':'married','alts':[]},
   {'q':'What do you offer in exchange?','pre':'I offer to take the','post':'night shift.','answer':'Friday','alts':['friday']},
   {'q':'Who must approve the trade?','pre':'The','post':'must confirm the swap.','answer':'manager','alts':['boss']},
 ],
 'il9': [
   {'q':'What broad subject interests you?','pre':'I am interested in renewable','post':'.','answer':'energy','alts':['power']},
   {'q':'How will you narrow the topic?','pre':'I will focus on','post':'power in desert regions.','answer':'solar','alts':[]},
   {'q':'How many academic sources are required?','pre':'I need at least','post':'academic sources.','answer':'five','alts':['5']},
 ],
 'il10': [
   {'q':'Why did you miss the lecture?','pre':'I had a bad','post':'.','answer':'cold','alts':['flu']},
   {'q':'How will you receive the notes?','pre':'I will get','post':'of the notes.','answer':'photos','alts':['pictures','pics']},
   {'q':'What will the quiz cover?','pre':'The quiz focuses on the last two','post':'.','answer':'chapters','alts':[]},
 ],
 'il11': [
   {'q':'What field do you want an internship in?','pre':'I want a position in','post':'.','answer':'marketing','alts':[]},
   {'q':'What will you add to your resume?','pre':'I will add my','post':'project.','answer':'statistics','alts':['stats']},
   {'q':'When is the application deadline?','pre':'The deadline is the end of','post':'.','answer':'March','alts':['march']},
 ],
 'il12': [
   {'q':'When is the presentation?','pre':'The presentation is on','post':'.','answer':'Thursday','alts':['thursday']},
   {'q':'Which section will you handle?','pre':'I will handle the project','post':'.','answer':'timeline','alts':['schedule']},
   {'q':'How many handouts will you print?','pre':'I will print','post':'copies.','answer':'twenty','alts':['20']},
 ],
}

def transform(c):
    turns = c['turns']
    dialogue = [
        {'speaker': 'partner' if t['kind'] == 'line' else 'you',
         'text': t['text'] if t['kind'] == 'line' else t['answer']}
        for t in turns
    ]
    choices = [t for t in turns if t['kind'] == 'choice']
    lines = [t for t in turns if t['kind'] == 'line']
    opener = {
        'prompt': 'Pick the best option to start the conversation',
        'options': choices[0]['options'],
        'answer': choices[0]['answer'],
        'explanation': choices[0].get('explanation', ''),
    }
    rounds = []
    # each later choice is preceded (in turn order) by partner line `lines[i]`
    for i in range(1, len(choices)):
        audio = lines[i]['text'] if i < len(lines) else ''
        rounds.append({
            'audio': audio,
            'prompt': 'Select the best response',
            'options': choices[i]['options'],
            'answer': choices[i]['answer'],
            'explanation': choices[i].get('explanation', ''),
        })
    return {
        'id': c['id'], 'scenario': c['scenario'],
        'partner': c['partner'], 'you': c['you'],
        'dialogue': dialogue,
        'comprehension': COMP[c['id']],
        'opener': opener,
        'rounds': rounds,
    }

def main():
    data = json.load(open(SRC, encoding='utf-8'))
    out = [transform(c) for c in data]
    with open(SRC, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f'rebuilt {len(out)} conversations -> new Interactive Listening schema')
    ex = out[0]
    print('sample:', ex['id'], '| dialogue turns:', len(ex['dialogue']),
          '| comprehension:', len(ex['comprehension']), '| rounds:', len(ex['rounds']))

if __name__ == '__main__':
    main()
