import { Box, keyframes } from '@mui/material';

export type BeeMood = 'happy' | 'sleepy' | 'lost' | 'dizzy';

const float = keyframes`
  0%, 100% { transform: translateY(0) rotate(-3deg); }
  50% { transform: translateY(-6px) rotate(3deg); }
`;

function Eyes({ mood }: { mood: BeeMood }) {
  switch (mood) {
    case 'sleepy':
      return (
        <g stroke="#1b1b1b" strokeWidth="3" strokeLinecap="round">
          <path d="M50 58 q6 5 12 0" fill="none" />
          <path d="M72 58 q6 5 12 0" fill="none" />
        </g>
      );
    case 'dizzy':
      return (
        <g stroke="#1b1b1b" strokeWidth="3" strokeLinecap="round">
          <path d="M51 52 l10 10 M61 52 l-10 10" />
          <path d="M73 52 l10 10 M83 52 l-10 10" />
        </g>
      );
    default:
      return (
        <g fill="#1b1b1b">
          <circle cx="56" cy="57" r="5" />
          <circle cx="78" cy="57" r="5" />
        </g>
      );
  }
}

function Extra({ mood }: { mood: BeeMood }) {
  if (mood === 'sleepy') {
    return (
      <g fill="currentColor" fontFamily="inherit" fontWeight="700">
        <text x="112" y="30" fontSize="16">z</text>
        <text x="124" y="18" fontSize="12">z</text>
      </g>
    );
  }
  if (mood === 'lost') {
    return (
      <text x="110" y="34" fontSize="28" fontWeight="700" fill="currentColor">
        ?
      </text>
    );
  }
  return null;
}

/** Friendly mascot used to soften empty and error states. Purely decorative. */
export function BeeMascot({ mood = 'happy', size = 140 }: { mood?: BeeMood; size?: number }) {
  return (
    <Box
      component="svg"
      viewBox="0 0 140 120"
      width={size}
      height={(size * 120) / 140}
      aria-hidden="true"
      focusable="false"
      sx={{
        color: 'text.secondary',
        animation: `${float} 3.2s ease-in-out infinite`,
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
      }}
    >
      <ellipse cx="50" cy="30" rx="20" ry="14" fill="#e3f2fd" stroke="#90caf9" strokeWidth="2" />
      <ellipse cx="82" cy="28" rx="20" ry="14" fill="#e3f2fd" stroke="#90caf9" strokeWidth="2" />
      <ellipse cx="68" cy="70" rx="42" ry="34" fill="#FFC107" stroke="#1b1b1b" strokeWidth="3" />
      <path d="M44 44 q-6 26 0 52" stroke="#1b1b1b" strokeWidth="9" fill="none" />
      <path d="M92 44 q6 26 0 52" stroke="#1b1b1b" strokeWidth="9" fill="none" />
      <path d="M110 70 l12 0" stroke="#1b1b1b" strokeWidth="4" strokeLinecap="round" />
      <Eyes mood={mood} />
      {mood === 'happy' && (
        <path d="M58 74 q9 8 18 0" stroke="#1b1b1b" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {mood !== 'happy' && (
        <path d="M60 78 q7 -4 14 0" stroke="#1b1b1b" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      <Extra mood={mood} />
    </Box>
  );
}
