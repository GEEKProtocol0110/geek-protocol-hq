(() => {
  'use strict';
  const firstLesson = '/study/?topic=origins&level=foundations';
  const topics = new Set(['origins','blockdag','mining','emission','wallets','tokens','ecosystem','fundamentals']);
  const lessonLink = (topic, review = false) => '/study/?' + new URLSearchParams({topic: topics.has(topic) ? topic : 'origins', ...(review ? {review:'1'} : {level:'foundations'})});
  const goals = {
    start: { label: 'I’m new here', message: 'Welcome to Geek. We can start small: one idea, one example, and a few questions. A.C.E. will walk you through your first Kaspa lesson.', action: 'Start my first lesson →', href: firstLesson },
    understand: { label: 'I want time to understand', message: 'There’s no rush. Read the ideas with A.C.E., then try an untimed question. You can return to the explanation whenever you need it.', action: 'Study at my pace →', href: '/study/' },
    practice: { label: 'I’m ready to try', message: 'Let’s give it a try. Free assisted practice includes 50/50 and Extra Time. Read each explanation before moving on.', action: 'Try practice with lifelines →', href: '/practice/' },
    review: { label: 'I want to revisit something', message: 'Coming back is part of learning. Your Progress page shows the Study concepts you explored and the ones ready for another look.', action: 'Find my next step →', href: '/profile/' }
  };
  const copy = (page, context = {}) => {
    if (page === 'memory') return {
      message: context.phase === 'complete' ? 'You connected every pair. Give the explanations another look, then choose a lesson or try a fresh board.' : context.phase === 'match' ? 'You found a connection. Take a moment with its explanation; there is no rush to find the next pair.' : 'Let’s connect the ideas together. Flip one card, then find its word or meaning. You can take as many tries as you need.',
      action: 'Want to explore the ideas? →', href: '/study/'
    };
    if (page === 'study' || page === 'study-welcome') {
      if (context.phase === 'summary') return { message: context.missed > 0 ? 'You showed up and tried. Give the ideas you missed another look, then try them again when you’re ready.' : 'You worked through this practice session. Keep your curiosity going: revisit the explanation or explore the next topic with A.C.E.', action: context.missed > 0 ? 'Revisit this lesson →' : 'See my learning progress →', href: context.missed > 0 ? lessonLink(context.topic) : '/profile/' };
      if (context.phase === 'correct') return { message: 'You connected that idea. Take a moment with A.C.E.’s explanation before the next question.', action: 'Explore the Kaspa guide →', href: '/kaspa/' };
      if (context.phase === 'missed') return { message: 'A missed answer is a place to start. Read A.C.E.’s explanation, look at the source, and take your time before trying the next idea.', action: 'Revisit this lesson →', href: lessonLink(context.topic) };
      if (context.phase === 'question') return { message: 'One question at a time. There’s no clock here, and you don’t have to know it all before you begin.', action: 'Open the Kaspa guide →', href: '/kaspa/' };
      return { message: context.phase === 'ready' ? 'You’ve reached the example. Think it through with A.C.E., then choose Start practice whenever you feel ready.' : 'I’m Giga, your learning buddy. Pick one idea and take your time. A.C.E. handles the lesson; I’ll help you keep moving.', action: 'Explore the Kaspa guide →', href: '/kaspa/' };
    }
    if (page === 'progress') {
      if (context.phase === 'unavailable') return { message: 'Your saved feedback isn’t available right now. You can retry below or keep learning with a lesson.', action: 'Choose a lesson →', href: '/study/' };
      if (!context.explored) return { message: 'Your next step can be a small one. Start with Where Kaspa began, read the lesson, and try a few untimed questions with A.C.E.', action: 'Start my first lesson →', href: firstLesson };
      if (context.review > 0) return { message: 'You have ideas ready for another look. A.C.E. can help you revisit the saved Study mistakes in your next topic.', action: 'Review my next topic →', href: lessonLink(context.topic, true) };
      return { message: 'Your saved feedback gives you a place to continue. Revisit a familiar idea or explore your next lesson with A.C.E.', action: 'Continue my next lesson →', href: lessonLink(context.topic) };
    }
    if (page === 'practice') {
      if (context.phase === 'finished') return { message: 'Thanks for practicing with me. Your next step can be another try, a slower lesson, or a break. Every question is something you can come back to.', action: 'Study at my pace →', href: '/study/' };
      if (context.phase === 'correct') return { message: 'You got that one. Read the explanation, then choose Next question when you’re ready. The next clock waits for you.', action: 'Explore Kaspa 101 →', href: '/kaspa/' };
      return { message: context.phase === 'timeout' ? 'The clock ended, but the learning doesn’t have to. Take your time with the answer. The next clock starts only when you choose Next question.' : 'Let’s use this answer as a starting point. Read the explanation and source before you try the next question.', action: 'Explore Kaspa 101 →', href: '/kaspa/' };
    }
    if (page === 'practice-welcome') return { message: 'I’m here to cheer you on. You get one 50/50 and one Extra Time boost in this free session. Use them when you need a little help.', action: 'Want an untimed lesson? →', href: '/study/' };
    return { message: 'Hey, I’m Giga. Glad you’re here. Tell me where you want to begin, and we’ll find one small next step together.', action: 'Start with one lesson →', href: firstLesson };
  };
  const guides = [...document.querySelectorAll('[data-giga-guide]')];
  const show = (root, value) => {
    root.querySelector('[data-giga-message]').textContent = value.message;
    const link = root.querySelector('[data-giga-action]'); link.textContent = value.action; link.href = value.href;
  };
  for (const root of guides) {
    const message = document.createElement('p'); message.dataset.gigaMessage = ''; message.setAttribute('role','status'); message.setAttribute('aria-live','polite'); message.setAttribute('aria-atomic','true');
    const action = document.createElement('a'); action.dataset.gigaAction = ''; action.className = 'giga-action';
    root.querySelector('[data-giga-content]').append(message, action);
    show(root, copy(root.dataset.gigaGuide));
    if (root.hasAttribute('data-giga-choices')) {
      const details = document.createElement('details'), summary = document.createElement('summary'); summary.textContent = 'Help me choose a next step'; details.append(summary);
      const choices = document.createElement('div'); choices.className = 'giga-choices';
      for (const [id,goal] of Object.entries(goals)) {
        const button = document.createElement('button'); button.type='button';button.textContent=goal.label;button.dataset.gigaGoal=id;button.setAttribute('aria-pressed','false');
        button.addEventListener('click',()=>{const changed=button.getAttribute('aria-pressed')!=='true';show(root,goal);choices.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));if(changed) window.GeekAnalytics?.track('Giga choice selected',{surface:root.dataset.gigaGuide,choice:id});});choices.append(button);
      }
      details.append(choices);root.querySelector('[data-giga-content]').append(details);
    }
  }
  window.GeekGiga = Object.freeze({ update(page, context) { for (const root of guides.filter(root=>root.dataset.gigaGuide===page)) { show(root,copy(page,context));root.querySelectorAll('[data-giga-goal]').forEach(b=>b.setAttribute('aria-pressed','false')); } } });
})();
