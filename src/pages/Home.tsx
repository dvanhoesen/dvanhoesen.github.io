export default function Home() {
  return (
    <section style={{ padding: 24 }}>
      <h1>Abelian Sandpile Simulation</h1>
      
      {/* Playable YouTube video */}
      <div style={{ marginTop: 16 }}>
        <iframe
          width="800"
          height="800"
          src="https://www.youtube.com/embed/GqQHJUpbCbU?si=sJaCklRwea_tTVXf"
          title="YouTube video player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        ></iframe>
      </div>

      {/* Direct link to YouTube */}
      <p style={{ marginTop: 12 }}>
        <a
          href="https://www.youtube.com/embed/GqQHJUpbCbU?si=sJaCklRwea_tTVXf"
          target="_blank"
          rel="noopener noreferrer"
        >
          Watch on YouTube
        </a>
      </p>

    </section>
  )
}