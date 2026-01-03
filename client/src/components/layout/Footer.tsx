export function Footer() {
  return (
    <footer className="bg-primary border-t rounded-b-lg">
      <div className="max-w-7xl mx-auto px-5">
        <div className="py-4 grid gap-6 md:grid-cols-2 items-start">
          <div className="max-w-md text-center md:text-left">
            <div className="text-lg font-semibold text-white">Moha</div>
            <p className="mt-1 text-xs text-white/90">
              Discover the finest collection of handcrafted sarees, celebrating
              the rich textile heritage of India.
            </p>
          </div>

          <nav className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs text-white text-center md:grid-cols-4 md:justify-self-end md:text-left">
            <a href="/returns-exchange-policy">Returns & Exchange</a>
            <a href="/shipping-policy">Shipping Policy</a>
            <a href="/faq">FAQ</a>
            <a href="/contact">Contact Us</a>
          </nav>
        </div>

        <div className="flex flex-col md:flex-row md:justify-end py-2">
          <p className="text-[10px] text-gray-400">
            © {new Date().getFullYear()} Moha. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
