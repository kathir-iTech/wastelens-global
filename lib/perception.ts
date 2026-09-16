// Vision perception layer.
// Named + measured model. Primary: YOLO12n or RF-DETR-base. Fallback: Gemini 2.5 Flash structured output.
// Outputs: object_class, material_surface, contamination, hazard_flags[], confidence.
// NEVER decides legal compliance. Only answers "what do I see?"

export interface PerceptionOutput {
  object_class: string;
  material_surface: string;
  contamination: boolean;
  hazard_flags: string[];
  confidence: number;
}

export async function perceive(image_path: string): Promise<PerceptionOutput> {
  // TODO: implement YOLO12n or RF-DETR-base with Gemini fallback
  throw new Error("Not implemented — to be built in session");
}
