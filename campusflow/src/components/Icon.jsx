const paths = {
  folder: 'M3 6h7l2 2h9v12H3z M3 6V4h7l2 2',
  refresh: 'M20 7v5h-5 M4 17v-5h5 M5 8a8 8 0 0 1 13-3l2 2 M19 16a8 8 0 0 1-13 3l-2-2',
  files: 'M14 2H6v20h14V8z M14 2v6h6 M9 12h8 M9 16h8',
  copy: 'M9 9h12v12H9z M15 9V3H3v12h6',
  home: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  tasks: 'M9 5h12 M9 12h12 M9 19h12 M3 5l1 1 2-2 M3 12l1 1 2-2 M3 19l1 1 2-2',
  calendar: 'M4 5h16v16H4z M8 3v4 M16 3v4 M4 10h16 M8 14h2 M14 14h2',
  gantt: 'M4 3v18h17 M7 6h6 M10 11h8 M15 16h6',
  award: 'M8 3h8v7a4 4 0 0 1-8 0z M8 5H4v3a4 4 0 0 0 4 4 M16 5h4v3a4 4 0 0 1-4 4 M12 14v6 M8 21h8',
  plus: 'M12 5v14 M5 12h14', search: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  arrow: 'M5 12h14 M13 6l6 6-6 6', download:'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5',
  close:'M6 6l12 12 M18 6L6 18', menu:'M4 6h16 M4 12h16 M4 18h16',
  check:'M5 12l4 4L19 6', clock:'M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M17 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-4',
}
export default function Icon({name, size=20}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.tasks}/></svg>
}
