// Evidence retrieval layer.
// Physical attributes -> jurisdiction corpus -> clauses via pgvector (Supabase).
// RAG retrieves evidence; the matrix decides.

export interface RetrievalResult {
  clause_id: string;
  rule_text: string;
  source_url: string;
  effective_date: string;
  jurisdiction: string;
  scope: string;
  fine_bracket: { min: number; max: number; currency: string } | null;
  exemptions: Array<{ condition: string; applies_until: string | null }> | null;
}

export async function retrieve(attributes: Record<string, unknown>, jurisdiction: string): Promise<RetrievalResult[]> {
  // TODO: implement pgvector semantic retrieval against Supabase
  throw new Error("Not implemented — to be built in session");
}
