import { ShareIcon } from './Icons';

interface Props {
  onDismiss?: () => void;
}

export default function InstallGuide({ onDismiss }: Props) {
  return (
    <section className="card install-guide" aria-label="Install the app">
      <h2>Install on your iPhone</h2>
      <ol>
        <li>
          Tap <ShareIcon /> <strong>Share</strong> in Safari's toolbar.
        </li>
        <li>
          Choose <strong>Add to Home Screen</strong>.
        </li>
        <li>Open Bike Logbook from the new home-screen icon.</li>
      </ol>
      <p className="hint">It then works offline, like a normal app. Your data stays on this phone.</p>
      {onDismiss && (
        <button type="button" className="btn btn-plain" onClick={onDismiss}>
          Not now
        </button>
      )}
    </section>
  );
}
