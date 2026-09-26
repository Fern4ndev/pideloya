import { NextResponse } from "next/server"

export async function POST(_request: Request) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- parámetro requerido por Next.js
  return NextResponse.json({ message: "Upload" })
}
