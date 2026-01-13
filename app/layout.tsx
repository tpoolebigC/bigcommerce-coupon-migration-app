import './globals.css'

export const metadata = {
  title: 'BigCommerce Coupon Migration',
  description: 'Easy coupon migration tool for BigCommerce',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
