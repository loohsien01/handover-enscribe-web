export default function AuthBrandPanel() {
  return (
    <section className="hidden lg:flex flex-col bg-[#183278] text-white px-12 py-14">
      <div className="flex-1">
        <a
          href="/"
          className="inline-flex items-center gap-3 text-2xl font-semibold tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-lg"
          aria-label="EnScribe home"
        >
          <img
            src="/enscribe-icon.svg"
            alt="EnScribe logo"
            className="h-10 w-10 rounded-lg bg-white px-0.5 object-contain"
            loading="eager"
            decoding="async"
          />
          <span>EnScribe</span>
        </a>
        <h1 className="mt-10 text-4xl font-semibold leading-tight tracking-tight">
          AI documentation for
          <br />
          modern healthcare teams.
        </h1>
        <p className="mt-6 text-base leading-7 text-white/80 max-w-md">
          Secure, efficient clinical note workflows designed for providers and
          staff.
        </p>
      </div>
    </section>
  );
}
