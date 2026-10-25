const P = {
  home: 'M3 11.5 12 4l9 7.5M5 10v10h5v-6h4v6h5V10',
  plus: 'M12 5v14M5 12h14',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.5-2-3.4-2.3.9a7.5 7.5 0 0 0-2.2-1.3L14.4 2h-4l-.4 2.4a7.5 7.5 0 0 0-2.2 1.3l-2.3-.9-2 3.4 2 1.5a7.400 7.400 0 0 0 0 2.600l-2 1.500 2 3.400 2.300-.9c.7.5 1.400 1 2.200 1.300l.4 2.400h4l.4-2.400c.8-.3 1.500-.8 2.200-1.300l2.300.9 2-3.400-2-1.500c.1-.4.1-.9.1-1.300z',
  out: 'M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M16 8l4 4-4 4M20 12H9',
  check: 'M5 12.5l4.500 4.500L19 7.500',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  download: 'M12 4v11m0 0-4-4m4 4 4-4M5 20h14',
  play: 'M8 5v14l11-7z',
  spark: 'M12 3l1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800zM19 16l.8 2.200L22 19l-2.200.8L19 22l-.8-2.200L16 19l2.200-.8z',
  retry: 'M4 12a8 8 0 0 1 14-5.300L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.300L4 15M4 20v-5h5',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  alert: 'M12 8v5m0 4h.01M10.300 3.900 2.400 17.500A2 2 0 0 0 4.100 20.500h15.800a2 2 0 0 0 1.700-3L13.700 3.900a2 2 0 0 0-3.400 0z',
  img: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9.500h.01',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4',
  film: 'M4 4h16v16H4zM8 4v16M16 4v16M4 9h4M4 15h4M16 9h4M16 15h4',
  text: 'M5 6V4h14v2M12 4v16M9 20h6',
  menu: 'M4 7h16M4 12h16M4 17h16',
};
export default function Icon({ name, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name]} />
    </svg>
  );
}
