// app/blog/admin/blog/edit/[id]/page.tsx
"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import * as React from "react";
import { useAuth } from "@/context/AuthContext";
import { getPostData, updatePost, createPost } from "@/lib/client/posts.client";
import { uploadFeaturedImage, uploadSecondaryImage } from "@/firebase/storageUtils";
import { PostData, SecondaryImage } from "@/types/post.types";
import { CATEGORIES } from "@/lib/constants/categories";
import TagInput from "@/app/blog/admin/components/TagInput";
import SEOPreview from "@/app/blog/admin/components/SEOPreview";
import SecondaryImagesManager from "@/app/blog/admin/components/SecondaryImagesManager";

// Interfaces para los datos
interface BasePostData {
  title: string;
  content: string;
  category: string;
  tags?: string[];
  status: "draft" | "published";
  featureImage?: string;
  slug: string;
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];
  secondaryImages?: SecondaryImage[];
}

// Convertir texto a slug con acentos correctos
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// Generar ID único para imágenes
function generateImageId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export default function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);

  const [formData, setFormData] = useState<BasePostData>({
    title: "",
    content: "",
    category: "tactica",
    tags: [],
    status: "draft",
    featureImage: "",
    slug: "",
    metaTitle: "",
    metaDescription: "",
    keywords: [],
    secondaryImages: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingSecondary, setUploadingSecondary] = useState(false);

  const router = useRouter();
  const { user, debugUserToken } = useAuth();

  // Cargar datos del post
  useEffect(() => {
    if (id && id !== "new") {
      const fetchPostData = async () => {
        try {
          setLoading(true);
          const postData: PostData | null = await getPostData(id);
          if (!postData) {
            console.error("Post no encontrado");
            return;
          }

          setFormData({
            ...postData,
            category: postData.category || "tactica",
            tags: postData.tags || [],
            secondaryImages: postData.secondaryImages || [],
          });
        } catch (error) {
          console.error("Error al obtener los datos del post:", error);
          alert("Ocurrió un error al cargar los datos del post.");
        } finally {
          setLoading(false);
        }
      };
      fetchPostData();
    } else {
      setLoading(false);
    }
  }, [id]);

  // Manejar cambios en el formulario
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === "title") {
      setFormData((prev) => ({
        ...prev,
        title: value,
        slug: prev.slug === "" || id === "new" ? generateSlug(value) : prev.slug,
      }));
    } else if (name === "slug") {
      setFormData((prev) => ({
        ...prev,
        slug: generateSlug(value),
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Regenerar slug desde el título
  const handleRegenerateSlug = () => {
    setFormData((prev) => ({
      ...prev,
      slug: generateSlug(prev.title),
    }));
  };

  // Manejar cambios en keywords
  const handleKeywordsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const keywords = e.target.value.split(",").map((keyword) => keyword.trim());
    setFormData((prev) => ({ ...prev, keywords: keywords || [] }));
  };

  // Manejar la subida de la imagen destacada
  const handleFeatureImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    try {
      const downloadURL = await uploadFeaturedImage(file, id);
      setFormData((prev) => ({ ...prev, featureImage: downloadURL }));
    } catch (error) {
      console.error("Error al subir la imagen destacada:", error);
      alert("Ocurrió un error al subir la imagen destacada.");
    }
  };

  // Manejar la subida de imágenes secundarias
  const handleSecondaryImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    try {
      setUploadingSecondary(true);
      const downloadURL = await uploadSecondaryImage(file, id);
      
      // Crear objeto de imagen secundaria
      const newImage: SecondaryImage = {
        id: generateImageId(),
        url: downloadURL,
        filename: file.name,
        uploadedAt: new Date(),
        insertedInContent: false,
        size: file.size,
      };
      
      // Agregar a la lista de imágenes secundarias
      setFormData((prev) => ({
        ...prev,
        secondaryImages: [...(prev.secondaryImages || []), newImage],
      }));
      
      // Limpiar el input
      e.target.value = "";
    } catch (error) {
      console.error("Error al subir la imagen secundaria:", error);
      alert("Ocurrió un error al subir la imagen secundaria.");
    } finally {
      setUploadingSecondary(false);
    }
  };

  // Insertar imagen en el contenido
  const handleInsertImage = (imageUrl: string, filename: string) => {
    const markdownImage = `![${filename}](${imageUrl})`;
    setFormData((prev) => ({
      ...prev,
      content: `${prev.content}\n\n${markdownImage}`,
      secondaryImages: prev.secondaryImages?.map(img =>
        img.url === imageUrl ? { ...img, insertedInContent: true } : img
      ),
    }));
  };

  // Eliminar imagen secundaria
  const handleDeleteSecondaryImage = (imageId: string) => {
    setFormData((prev) => ({
      ...prev,
      secondaryImages: prev.secondaryImages?.filter(img => img.id !== imageId),
    }));
  };

  // Guardar el post
  const handleSave = async () => {
    if (!user) {
      alert("Debes iniciar sesión para guardar posts");
      return;
    }
    if (!formData.title || !formData.content || !formData.slug || !formData.category) {
      alert("Por favor, completa todos los campos obligatorios (título, contenido, slug y categoría).");
      return;
    }
    try {
      setSaving(true);
      const postBaseData = {
        title: formData.title,
        content: formData.content,
        slug: formData.slug,
        category: formData.category,
        status: formData.status,
        author: {
          uid: user.uid,
          displayName: user.displayName || "Admin",
          email: user.email || "",
        },
        featureImage: formData.featureImage || undefined,
        tags: formData.tags || [],
        metaTitle: formData.metaTitle || formData.title,
        metaDescription: formData.metaDescription || "",
        keywords: formData.keywords || [],
        secondaryImages: formData.secondaryImages || [],
      };
      if (id === "new") {
        await createPost(postBaseData);
      } else {
        await updatePost(id, {
          ...postBaseData,
          likes: 0,
          views: 0,
        });
      }
      alert("Post guardado exitosamente.");
      router.push("/blog/admin/blog");
    } catch (error) {
      console.error("Error al guardar el post:", error);
      alert("Ocurrió un error al guardar el post.");
    } finally {
      setSaving(false);
    }
  };

  // Función para manejar el clic en el botón de depuración
  const handleDebugToken = async () => {
    if (!debugUserToken) {
      console.warn("La función debugUserToken no está disponible.");
      return;
    }
    try {
      await debugUserToken();
      alert("Revisa la consola para ver los claims del token.");
    } catch (error) {
      console.error("Error al depurar el token:", error);
      alert("Ocurrió un error al depurar el token.");
    }
  };

  if (loading) {
    return (
      <div 
        className="flex items-center justify-center min-h-screen"
        role="status"
        aria-live="polite"
        aria-label="Cargando datos del post"
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bluegreen-eske mx-auto" aria-hidden="true"></div>
          <p className="mt-4 text-black-eske-20 dark:text-[#9AAEBE]">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-black-eske dark:text-[#EAF2F8] mb-6">
        {id === "new" ? "Crear Nuevo Post" : "Editar Post"}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna principal - Formulario (2/3) */}
        <div className="lg:col-span-2">
          <div className="bg-white-eske dark:bg-[#18324A] rounded-xl shadow-md p-6">
            <form 
              onSubmit={(e) => e.preventDefault()} 
              className="space-y-6"
              aria-label="Formulario para crear o editar post del blog"
            >
              {/* Título */}
              <div>
                <label 
                  htmlFor="title"
                  className="block text-sm font-semibold text-black-eske-40 dark:text-[#C7D6E0] mb-2"
                >
                  Título <span className="text-red-eske" aria-label="campo requerido">*</span>
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-eske-30 dark:border-white/10 dark:bg-[#112230] dark:text-[#EAF2F8] rounded-lg focus-ring-primary"
                  placeholder="Título del post"
                  aria-required="true"
                />
              </div>

              {/* Slug */}
              <div>
                <label 
                  htmlFor="slug"
                  className="block text-sm font-semibold text-black-eske-40 dark:text-[#C7D6E0] mb-2"
                >
                  Slug (URL) <span className="text-red-eske" aria-label="campo requerido">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="slug"
                    name="slug"
                    value={formData.slug}
                    onChange={handleChange}
                    required
                    className="flex-1 px-4 py-2 border border-gray-eske-30 dark:border-white/10 dark:bg-[#112230] dark:text-[#EAF2F8] rounded-lg focus-ring-primary"
                    placeholder="slug-del-post"
                    aria-required="true"
                    aria-describedby="slug-hint"
                  />
                  <button
                    type="button"
                    onClick={handleRegenerateSlug}
                    className="px-4 py-2 bg-blue-eske text-white rounded-lg hover:bg-blue-eske-70 transition-colors font-semibold whitespace-nowrap focus-ring-primary"
                    title="Regenerar slug desde el título"
                    aria-label="Regenerar slug desde el título"
                  >
                    🔄 Regenerar
                  </button>
                </div>
                <p 
                  id="slug-hint"
                  className="text-xs text-black-eske-20 dark:text-[#9AAEBE] mt-1"
                >
                  Se genera automáticamente desde el título, pero puedes editarlo manualmente
                </p>
              </div>

              {/* Categoría */}
              <div>
                <label 
                  htmlFor="category"
                  className="block text-sm font-semibold text-black-eske-40 dark:text-[#C7D6E0] mb-2"
                >
                  Categoría <span className="text-red-eske" aria-label="campo requerido">*</span>
                </label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-eske-30 dark:border-white/10 dark:bg-[#112230] dark:text-[#EAF2F8] rounded-lg focus-ring-primary"
                  aria-required="true"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Contenido */}
              <div>
                <label 
                  htmlFor="content"
                  className="block text-sm font-semibold text-black-eske-40 dark:text-[#C7D6E0] mb-2"
                >
                  Contenido <span className="text-red-eske" aria-label="campo requerido">*</span>
                </label>
                <textarea
                  id="content"
                  name="content"
                  value={formData.content}
                  onChange={handleChange}
                  required
                  rows={12}
                  className="w-full px-4 py-2 border border-gray-eske-30 dark:border-white/10 dark:bg-[#112230] dark:text-[#EAF2F8] rounded-lg focus-ring-primary font-mono text-sm"
                  placeholder="Contenido en Markdown..."
                  aria-required="true"
                  aria-describedby="content-hint"
                />
                <p 
                  id="content-hint"
                  className="text-xs text-black-eske-20 dark:text-[#9AAEBE] mt-1"
                >
                  Usa Markdown para formatear el contenido
                </p>
              </div>

              {/* Continúa en parte 2... */}
              {/* Tags */}
              <div>
                <label 
                  htmlFor="tags-input"
                  className="block text-sm font-semibold text-black-eske-40 dark:text-[#C7D6E0] mb-2"
                >
                  Tags (Etiquetas)
                </label>
                <TagInput
                  value={formData.tags || []}
                  onChange={(tags) => setFormData((prev) => ({ ...prev, tags }))}
                />
              </div>

              {/* Keywords */}
              <div>
                <label 
                  htmlFor="keywords"
                  className="block text-sm font-semibold text-black-eske-40 dark:text-[#C7D6E0] mb-2"
                >
                  Palabras clave (SEO)
                </label>
                <input
                  type="text"
                  id="keywords"
                  name="keywords"
                  value={formData.keywords?.join(", ") || ""}
                  onChange={handleKeywordsChange}
                  placeholder="política, estrategia, campaña"
                  className="w-full px-4 py-2 border border-gray-eske-30 dark:border-white/10 dark:bg-[#112230] dark:text-[#EAF2F8] rounded-lg focus-ring-primary"
                  aria-describedby="keywords-hint"
                />
                <p 
                  id="keywords-hint"
                  className="text-xs text-black-eske-20 dark:text-[#9AAEBE] mt-1"
                >
                  Separadas por comas para SEO
                </p>
              </div>

              {/* Meta Title */}
              <div>
                <label 
                  htmlFor="metaTitle"
                  className="block text-sm font-semibold text-black-eske-40 dark:text-[#C7D6E0] mb-2"
                >
                  Meta Title (SEO)
                </label>
                <input
                  type="text"
                  id="metaTitle"
                  name="metaTitle"
                  value={formData.metaTitle}
                  onChange={handleChange}
                  placeholder="Por defecto usa el título del post"
                  className="w-full px-4 py-2 border border-gray-eske-30 dark:border-white/10 dark:bg-[#112230] dark:text-[#EAF2F8] rounded-lg focus-ring-primary"
                  aria-describedby="metaTitle-hint"
                />
                <p 
                  id="metaTitle-hint"
                  className="text-xs text-black-eske-20 dark:text-[#9AAEBE] mt-1"
                >
                  Usa el título del post si se deja vacío
                </p>
              </div>

              {/* Meta Description */}
              <div>
                <label 
                  htmlFor="metaDescription"
                  className="block text-sm font-semibold text-black-eske-40 dark:text-[#C7D6E0] mb-2"
                >
                  Meta Description (SEO)
                </label>
                <textarea
                  id="metaDescription"
                  name="metaDescription"
                  value={formData.metaDescription}
                  onChange={handleChange}
                  rows={3}
                  maxLength={160}
                  placeholder="Descripción para SEO (max 160 caracteres)"
                  className="w-full px-4 py-2 border border-gray-eske-30 dark:border-white/10 dark:bg-[#112230] dark:text-[#EAF2F8] rounded-lg focus-ring-primary"
                  aria-describedby="metaDescription-hint"
                />
                <p 
                  id="metaDescription-hint"
                  className="text-xs text-black-eske-20 dark:text-[#9AAEBE] mt-1"
                >
                  {formData.metaDescription?.length || 0}/160 caracteres
                </p>
              </div>

              {/* Imagen Destacada */}
              <div>
                <label 
                  htmlFor="featureImage"
                  className="block text-sm font-semibold text-black-eske-40 dark:text-[#C7D6E0] mb-2"
                >
                  Imagen Destacada
                </label>
                <input
                  type="file"
                  id="featureImage"
                  accept="image/*"
                  onChange={handleFeatureImageUpload}
                  className="w-full px-4 py-2 border border-gray-eske-30 rounded-lg focus-ring-primary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-bluegreen-eske file:text-white hover:file:bg-bluegreen-eske-70 file:cursor-pointer"
                  aria-describedby="featureImage-hint"
                />
                <p 
                  id="featureImage-hint"
                  className="text-xs text-black-eske-20 dark:text-[#9AAEBE] mt-1"
                >
                  Imagen principal del post (recomendado: 1200x630px)
                </p>
                {formData.featureImage && (
                  <div className="mt-3">
                    <img
                      src={formData.featureImage}
                      alt="Vista previa de imagen destacada del post"
                      className="w-full max-w-md h-48 object-cover rounded-lg shadow-md"
                    />
                  </div>
                )}
              </div>

              {/* Imágenes Secundarias */}
              <div>
                <label 
                  htmlFor="secondaryImages"
                  className="block text-sm font-semibold text-black-eske-40 dark:text-[#C7D6E0] mb-2"
                >
                  Imágenes Secundarias
                </label>
                <input
                  type="file"
                  id="secondaryImages"
                  accept="image/*"
                  onChange={handleSecondaryImageUpload}
                  disabled={uploadingSecondary}
                  className="w-full px-4 py-2 border border-gray-eske-30 rounded-lg focus-ring-primary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-eske file:text-white hover:file:bg-blue-eske-70 disabled:opacity-50 file:cursor-pointer"
                  aria-describedby="secondaryImages-hint"
                />
                <p 
                  id="secondaryImages-hint"
                  className="text-xs text-black-eske-20 dark:text-[#9AAEBE] mt-1"
                >
                  {uploadingSecondary ? "Subiendo imagen..." : "Sube imágenes y luego insértalas en el contenido"}
                </p>

                {/* Manager de imágenes secundarias */}
                {formData.secondaryImages && formData.secondaryImages.length > 0 && (
                  <div className="mt-4">
                    <SecondaryImagesManager
                      images={formData.secondaryImages}
                      content={formData.content}
                      onImagesChange={(images) => setFormData(prev => ({ ...prev, secondaryImages: images }))}
                      onInsertImage={handleInsertImage}
                      onDeleteImage={handleDeleteSecondaryImage}
                    />
                  </div>
                )}
              </div>

              {/* Estado */}
              <div>
                <label 
                  htmlFor="status"
                  className="block text-sm font-semibold text-black-eske-40 dark:text-[#C7D6E0] mb-2"
                >
                  Estado
                </label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-eske-30 dark:border-white/10 dark:bg-[#112230] dark:text-[#EAF2F8] rounded-lg focus-ring-primary"
                >
                  <option value="draft">Borrador</option>
                  <option value="published">Publicado</option>
                </select>
              </div>

              {/* Botones */}
              <div className="flex gap-4 pt-4 border-t border-gray-eske-30 dark:border-white/10">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 px-6 py-3 bg-bluegreen-eske text-white rounded-lg hover:bg-bluegreen-eske-70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold shadow-md focus-ring-primary"
                  aria-label={saving ? "Guardando cambios del post" : "Guardar cambios del post"}
                >
                  {saving ? "Guardando..." : "Guardar Cambios"}
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/blog/admin/blog")}
                  className="px-6 py-3 bg-gray-eske-40 dark:bg-white/10 text-black-eske dark:text-[#C7D6E0] rounded-lg hover:bg-gray-eske-60 dark:hover:bg-white/15 transition-colors font-semibold shadow-md focus-ring-primary"
                  aria-label="Cancelar edición y volver a lista de posts"
                >
                  Cancelar
                </button>
              </div>

              {/* Botón Debug */}
              {typeof debugUserToken === "function" && (
                <div className="pt-4 border-t border-gray-eske-30 dark:border-white/10">
                  <button
                    type="button"
                    onClick={handleDebugToken}
                    className="w-full px-4 py-2 bg-green-eske text-white rounded-lg hover:bg-green-eske-70 transition-colors text-sm font-medium focus-ring-primary"
                    aria-label="Depurar token de autenticación del usuario"
                  >
                    🔍 Depurar Token del Usuario
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Columna lateral - SEO Preview (1/3) */}
        <aside 
          className="lg:col-span-1"
          aria-labelledby="seo-preview-title"
        >
          <div className="sticky top-8 space-y-6">
            {/* SEO Preview */}
            <section aria-labelledby="seo-preview-title">
              <h2 id="seo-preview-title" className="sr-only">Vista previa de SEO</h2>
              <SEOPreview
                title={formData.metaTitle || formData.title}
                description={formData.metaDescription || formData.content.substring(0, 160)}
                imageUrl={formData.featureImage}
                slug={formData.slug}
              />
            </section>

            {/* Tips de SEO */}
            <section 
              className="bg-blue-eske-10 dark:bg-[#112230] rounded-xl p-4 border border-blue-eske-30 dark:border-white/10"
              role="note"
              aria-labelledby="seo-tips-title"
            >
              <h3 
                id="seo-tips-title"
                className="text-sm font-bold text-blue-eske mb-3 flex items-center gap-2"
              >
                <svg 
                  className="w-4 h-4" 
                  fill="currentColor" 
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Tips de SEO
              </h3>
              <ul 
                className="space-y-2 text-xs text-black-eske-40 dark:text-[#C7D6E0]"
                role="list"
                aria-label="5 consejos de SEO"
              >
                <li className="flex items-start gap-2" role="listitem">
                  <span className="text-bluegreen-eske mt-0.5" aria-hidden="true">•</span>
                  <span>Usa títulos descriptivos de 50-60 caracteres</span>
                </li>
                <li className="flex items-start gap-2" role="listitem">
                  <span className="text-bluegreen-eske mt-0.5" aria-hidden="true">•</span>
                  <span>Meta descripción ideal: 150-160 caracteres</span>
                </li>
                <li className="flex items-start gap-2" role="listitem">
                  <span className="text-bluegreen-eske mt-0.5" aria-hidden="true">•</span>
                  <span>Incluye palabras clave en título y descripción</span>
                </li>
                <li className="flex items-start gap-2" role="listitem">
                  <span className="text-bluegreen-eske mt-0.5" aria-hidden="true">•</span>
                  <span>La imagen destacada debe ser 1200x630px para redes</span>
                </li>
                <li className="flex items-start gap-2" role="listitem">
                  <span className="text-bluegreen-eske mt-0.5" aria-hidden="true">•</span>
                  <span>Slug debe ser corto, descriptivo y sin acentos</span>
                </li>
              </ul>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
