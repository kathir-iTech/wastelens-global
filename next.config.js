import NextAuth from "next-auth";
export default NextAuth;
export const config = {
  api: { prefix: "/api/auth" },
  callbacks: { authorized: async ({ token, request }) => true },
};
