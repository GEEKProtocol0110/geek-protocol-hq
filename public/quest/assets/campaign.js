import { questChapters, checksFor } from './chapter.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const chapterHref = chapter => `/quest/?chapter=${encodeURIComponent(chapter.id)}`;
export const campaignCards = (summaries, selectedId) => questChapters.map(chapter => {
  const saved = summaries?.find(s => s.chapterId === chapter.id), active = chapter.id === selectedId;
  const status = summaries === null ? 'Connecting saved progress…' : !saved?.available ? 'Saved status unavailable · open to retry' : saved.status === 'unstarted' ? 'Ready to explore · progress starts when you choose Begin' : saved.status === 'complete' ? 'Latest visit complete · review your notes' : `${saved.answered} / ${saved.total} checks attempted · saved visit in progress`;
  return `<a class="campaign-chapter${active ? ' selected' : ''}" data-campaign-chapter="${escape(chapter.id)}" href="${chapterHref(chapter)}"${active ? ' aria-current="page"' : ''}><span class="campaign-number">${String(chapter.number).padStart(2, '0')}</span><div><small>CHAPTER ${String(chapter.number).padStart(2, '0')} · ${chapter.scenes.length} STOPS · ${checksFor(chapter).length} CHECKS</small><h3>${escape(chapter.title)}</h3><p>${escape(chapter.subtitle)}</p><strong class="campaign-status">${escape(status)}</strong>${saved?.available && saved.badge ? `<span class="campaign-badge">✦ ${escape(chapter.badge.name)} · SAVED</span>` : ''}<span class="campaign-action">${active ? 'Current chapter' : saved?.available && saved.status !== 'unstarted' ? 'Open saved chapter →' : 'Explore chapter →'}</span></div></a>`;
}).join('');

export const campaignSummary = summaries => {
  const available = summaries.filter(s => s.available);
  const badges = available.filter(s => s.badge).length;
  return `${badges} / ${questChapters.length} chapter badges saved${available.length < questChapters.length ? ' · some chapter statuses are unavailable' : ''}. Choose any chapter; each keeps its own progress.`;
};
