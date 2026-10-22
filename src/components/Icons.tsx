import type { ReactNode } from 'react';

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const GaugeIcon = () => (
  <Svg>
    <path d="M3.5 17a8.5 8.5 0 1 1 17 0" />
    <path d="M12 17l4.5-5.5" />
  </Svg>
);

export const ListIcon = () => (
  <Svg>
    <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </Svg>
);

export const WrenchIcon = () => (
  <Svg>
    <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3.5 17.5l3 3 5.8-5.8a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />
  </Svg>
);

export const ChartIcon = () => (
  <Svg>
    <path d="M4 20h16M7 16v-5M12 16V6M17 16v-8" />
  </Svg>
);

export const GearIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
  </Svg>
);

export const PlusIcon = () => (
  <Svg>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const ShareIcon = () => (
  <Svg>
    <path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
  </Svg>
);

export const CheckIcon = () => (
  <Svg>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);

export const ChevronIcon = () => (
  <Svg>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);

export const CameraIcon = () => (
  <Svg>
    <path d="M4 8h3l2-2.5h6L17 8h3v11H4z" />
    <circle cx="12" cy="13" r="3.5" />
  </Svg>
);
