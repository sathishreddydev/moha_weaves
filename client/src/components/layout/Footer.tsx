export function Footer() {
  return (
    <footer className="bg-white border-t">
      <div className="max-w-7xl mx-auto px-6 py-5">
        <div className="flex flex-col md:flex-row md:justify-between gap-6">
          <div className="max-w-md">
            <h3 className="text-lg font-semibold text-primary">Moha</h3>
            <p className="mt-2 text-xs text-gray-500">
              Discover the finest collection of handcrafted sarees, celebrating
              the rich textile heritage of India.
            </p>
          </div>

          <nav className="flex flex-wrap gap-x-6 text-xs text-primary">
            <a href="/blog">Returns & Exchange</a>
            <a href="/shop">Shipping Policy</a>
            <a href="/contact">FAQ</a>
            <a href="/contact">Contact Us</a>
          </nav>
        </div>

        <div className="my-2 h-px bg-gray-200" />

        <div className="flex flex-col md:flex-row md:justify-end">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} Moha. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
