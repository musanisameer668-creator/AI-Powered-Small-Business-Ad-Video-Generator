import { Link } from 'react-router-dom';
import Brand from '../components/Brand.jsx';
import { useAuth } from '../auth.jsx';

const STEPS = [
  ['Tell us about your shop', 'Name, product, offer and city. Write in Hindi, English or Hinglish.'],
  ['Gemini writes the ad', 'Headline, caption, hashtags, a voiceover script and three scenes.'],
  ['Pictures and voice', 'Three promo pictures and a natural voiceover, made at the same time.'],
  ['Download your video', 'A short MP4 for Instagram Reels and WhatsApp Status.'],
];

export default function Landing() {
  const { user } = useAuth();
  return (
    <div className="landing">
      <header className="l-nav">
        <Brand />
        <nav>
          {user ? <Link className="btn primary" to="/dashboard">Open dashboard</Link> : (
            <>
              <Link className="btn ghost" to="/login">Log in</Link>
              <Link className="btn primary" to="/register">Get started</Link>
            </>
          )}
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="pill">Free to run · Hindi, English, Hinglish</p>
          <h1>Apni dukaan ka ad,<br />ek click mein.</h1>
          <p className="lead">Describe your shop in a few lines. AdMitra writes the caption, makes the pictures, records a voiceover and hands you a video that is ready to post.</p>
          <div className="row gap">
            <Link className="btn primary lg" to={user ? '/create' : '/register'}>Create my first ad</Link>
            <a className="btn ghost lg" href="#how">See how it works</a>
          </div>
        </div>

        <div className="stage" aria-hidden="true">
          <div className="phone">
            <div className="phone-notch" />
            <div className="reel">
              <div className="reel-brand"><i />Sharma Chai Corner</div>
              <div className="reel-scenes">
                <p className="s s1">Garma garam chai</p>
                <p className="s s2">Taaza samosa ke saath</p>
                <p className="s s3">2 chai pe 1 samosa free</p>
              </div>
              <div className="reel-bar"><b /></div>
            </div>
          </div>
          <div className="float f1"><small>Caption</small>Chai ka asli mazaa ☕</div>
          <div className="float f2"><small>Voiceover</small><span className="wave"><i /><i /><i /><i /><i /><i /></span></div>
        </div>
      </section>

      <section className="how" id="how">
        <h2>From a few words to a finished video</h2>
        <ol className="how-steps">
          {STEPS.map(([t, d], i) => (
            <li key={t}><span className="num">{i + 1}</span><h3>{t}</h3><p>{d}</p></li>
          ))}
        </ol>
      </section>

      <section className="cta-band">
        <div>
          <h2>Built for the shop on the corner</h2>
          <p>Chai stalls, boutiques, salons, bakeries and tuition classes. No design skills, no editing app, no paid tools.</p>
        </div>
        <Link className="btn primary lg" to={user ? '/create' : '/register'}>Make an ad now</Link>
      </section>

      <footer className="l-foot">
        <Brand />
        <small>Foundation of AI &amp; Prompt Engineering microproject · Shah &amp; Anchor Kutchhi Engineering College</small>
      </footer>
    </div>
  );
}
