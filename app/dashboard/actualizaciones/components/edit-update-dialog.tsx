"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
    Loader2,
    ImagePlus,
    X,
    Image as ImageIcon,
    HelpCircle,
    Check,
    Hash,
    List,
    Type,
    Bold as BoldIcon,
    Code,
    Sparkles,
    Link,
    Quote,
    Minus,
    Table,
    Info
} from "lucide-react";
import { SystemUpdate, updateSystemUpdate } from "../../actions-updates";
import { createClient } from "@/utils/supabase/client";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

const formSchema = z.object({
    title: z.string().min(1, "El título es requerido"),
    summary: z.string().min(1, "El resumen es requerido"),
    content: z.string().optional(),
    category: z.enum(["Feature", "Improvement", "Fix", "Security", "Maintenance"]),
});

interface EditUpdateDialogProps {
    update: SystemUpdate;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const MARKDOWN_GUIDE = [
    { icon: Hash, label: "Títulos", code: "# Título\n## Subtítulo" },
    { icon: BoldIcon, label: "Negrita", code: "**texto**" },
    { icon: List, label: "Listas", code: "- Elemento 1\n- Elemento 2" },
    { icon: Link, label: "Enlaces", code: "[Texto](url)" },
    { icon: Code, label: "Código", code: "`const x = 1`" },
    { icon: Quote, label: "Citas", code: "> Mensaje importante" },
    { icon: Minus, label: "Separador", code: "---" },
    { icon: Table, label: "Tablas", code: "| Uno | Dos |\n|---|---|" },
];

export function EditUpdateDialog({ update, isOpen, onClose, onSuccess }: EditUpdateDialogProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [images, setImages] = useState<string[]>(update.images || []);
    const [captions, setCaptions] = useState<string[]>(update.image_captions || []);
    const supabase = createClient();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: update.title || "",
            summary: update.summary || "",
            content: update.content || "",
            category: (update.category as any) || "Improvement",
        },
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            await updateSystemUpdate(update.id, {
                ...values,
                images,
                image_captions: captions,
            });
            toast.success("Actualización guardada correctamente");
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar la actualización");
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        try {
            const newImages = [...images];
            const newCaptions = [...captions];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fileExt = file.name.split(".").pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `${update.id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from("system-updates")
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from("system-updates")
                    .getPublicUrl(filePath);

                newImages.push(publicUrl);
                newCaptions.push(""); // Initial empty caption
            }

            setImages(newImages);
            setCaptions(newCaptions);
            toast.success("Imágenes subidas correctamente");
        } catch (error) {
            console.error(error);
            toast.error("Error al subir las imágenes");
        } finally {
            setIsUploading(false);
        }
    };

    const removeImage = (index: number) => {
        setImages(images.filter((_, i) => i !== index));
        setCaptions(captions.filter((_, i) => i !== index));
    };

    const updateCaption = (index: number, text: string) => {
        const newCaptions = [...captions];
        newCaptions[index] = text;
        setCaptions(newCaptions);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Editar Actualización</DialogTitle>
                    <DialogDescription>
                        Modifica los detalles de la actualización y añade contenido enriquecido.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="title"
                                render={({ field }) => (
                                    <FormItem className="md:col-span-2">
                                        <FormLabel>Título</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="category"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Categoría</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecciona una categoría" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Feature">Nueva Función</SelectItem>
                                                <SelectItem value="Improvement">Mejora</SelectItem>
                                                <SelectItem value="Fix">Corrección</SelectItem>
                                                <SelectItem value="Security">Seguridad</SelectItem>
                                                <SelectItem value="Maintenance">Mantenimiento</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="summary"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Resumen (Vista rápida)</FormLabel>
                                    <FormControl>
                                        <Textarea {...field} rows={3} placeholder="Breve descripción de los cambios..." />
                                    </FormControl>
                                    <FormDescription>
                                        Este texto aparece en la tarjeta principal si no hay contenido detallado.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="content"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="flex items-center justify-between">
                                        <FormLabel>Contenido Detallado (Markdown)</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-red-600">
                                                    <HelpCircle className="w-3.5 h-3.5 mr-1" />
                                                    Guía Markdown
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent
                                                className="w-[calc(100vw-40px)] sm:w-[500px] p-0 overflow-hidden shadow-2xl border-red-600/20"
                                                align="end"
                                                side="bottom"
                                                sideOffset={12}
                                                collisionPadding={20}
                                                onOpenAutoFocus={(e) => e.preventDefault()}
                                            >
                                                <div className="bg-red-600 p-3 text-white flex items-center justify-between">
                                                    <h4 className="font-bold text-sm flex items-center gap-2">
                                                        <Sparkles className="w-4 h-4" />
                                                        Tips de Formato Markdown
                                                    </h4>
                                                </div>
                                                <div
                                                    className="p-4 max-h-[350px] overflow-y-auto custom-scrollbar overscroll-contain"
                                                    onWheel={(e) => e.stopPropagation()}
                                                    onTouchStart={(e) => e.stopPropagation()}
                                                >
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        {MARKDOWN_GUIDE.map((item) => (
                                                            <div key={item.label} className="p-2.5 rounded-lg bg-muted/30 border border-border/50 hover:border-red-600/30 transition-colors group/guide">
                                                                <div className="flex items-center gap-2 mb-1.5">
                                                                    <item.icon className="w-3.5 h-3.5 text-red-600 group-hover/guide:scale-110 transition-transform" />
                                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{item.label}</span>
                                                                </div>
                                                                <code className="text-[11px] block text-foreground font-mono bg-background/50 p-1.5 rounded border border-border/30 whitespace-pre overflow-x-auto">
                                                                    {item.code}
                                                                </code>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="mt-4 p-3 rounded-md bg-red-600/5 border border-red-600/10 flex items-start gap-2">
                                                        <Info className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                                                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                                                            <strong>Tip:</strong> El contenido detallado se renderiza con <strong>prose-reyper</strong>, dándole prioridad visual sobre el resumen en el feed.
                                                        </p>
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <FormControl>
                                        <Textarea {...field} rows={8} placeholder="Usa títulos (#), listas (-), etc." />
                                    </FormControl>
                                    <FormDescription>
                                        Al escribir aquí, este contenido reemplazará al resumen en la vista principal.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="space-y-4">
                            <FormLabel>Imágenes y Pies de Foto</FormLabel>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {images.map((url, index) => (
                                    <div key={url} className="flex flex-col gap-2 p-3 rounded-xl border bg-muted/30 group relative">
                                        <div className="relative aspect-video rounded-lg overflow-hidden border bg-black/5">
                                            <img src={url} alt={`Preview ${index}`} className="w-full h-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => removeImage(index)}
                                                className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-lg transition-transform hover:scale-110"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        <Input
                                            placeholder="Pie de imagen..."
                                            className="h-8 text-xs bg-background"
                                            value={captions[index] || ""}
                                            onChange={(e) => updateCaption(index, e.target.value)}
                                        />
                                    </div>
                                ))}
                                <label className="flex flex-col items-center justify-center aspect-video rounded-xl border-2 border-dashed border-muted-foreground/20 hover:border-red-600/50 hover:bg-red-600/5 cursor-pointer transition-all group/upload">
                                    {isUploading ? (
                                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                                    ) : (
                                        <>
                                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2 group-hover/upload:bg-red-600/10 group-hover/upload:text-red-600 transition-colors">
                                                <ImagePlus className="w-5 h-5" />
                                            </div>
                                            <span className="text-xs font-bold text-muted-foreground">Añadir Imagen</span>
                                            <span className="text-[10px] text-muted-foreground/60 mt-1">Soporta múltiples archivos</span>
                                        </>
                                    )}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                        onChange={handleImageUpload}
                                        disabled={isUploading}
                                    />
                                </label>
                            </div>
                        </div>

                        <DialogFooter className="pt-6 border-t">
                            <Button type="button" variant="outline" onClick={onClose} disabled={form.formState.isSubmitting}>
                                Cancelar
                            </Button>
                            <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white min-w-[120px]" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Check className="mr-2 h-4 w-4" />
                                )}
                                Guardar Cambios
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
