export function Footer() {
  return (
    <footer className="bg-primary border-t rounded-b-lg">
      <div className="max-w-7xl mx-auto px-6">
        <div className="py-4 flex flex-col md:flex-row md:justify-between gap-6">
          <div className="max-w-md">
            <div className="text-lg font-semibold text-white">Moha</div>
            <p className="mt text-xs text-white/90">
              Discover the finest collection of handcrafted sarees, celebrating
              the rich textile heritage of India.
            </p>
          </div>

          <nav className="flex gap-x-6 text-xs text-white">
            <a href="/blog">Returns & Exchange</a>
            <a href="/shop">Shipping Policy</a>
            <a href="/contact">FAQ</a>
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
