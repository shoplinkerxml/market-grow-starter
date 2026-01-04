import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, X, Upload, Link, Check } from "lucide-react";
import { toast } from "sonner";
import { ProductService } from "@/lib/product-service";
import { SupplierService } from "@/lib/supplier-service";
import { supabase } from "@/integrations/supabase/client";
import { R2Storage } from "@/lib/r2-storage";
import { useI18n } from "@/i18n";
import { getImageUrl, IMAGE_SIZES } from "@/lib/imageUtils";
import { ImageHelpers } from "@/utils/imageHelpers";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";

interface ProductFormProps {
  product?: any | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface ProductParam {
  name: string;
  value: string;
  order_index: number;
}

interface ProductImage {
  url: string;
  order_index: number;
  alt_text?: string;
  is_main?: boolean;
  object_key?: string;
}

export const ProductForm = ({ product, onSuccess, onCancel }: ProductFormProps) => {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { user } = useOutletContext<{ user: { id?: string } | null }>();
  const uid = user?.id ? String(user.id) : "current";
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    // Основна інформація
    name: '',
    name_ua: '',
    description: '',
    description_ua: '',
    external_id: '',
    
    // Зв'язки
    store_id: '',
    supplier_id: '',
    category_id: '',
    currency_id: '',
    
    // Товарна інформація
    vendor: '',
    article: '',
    
    
    // Ціни
    price: '',
    price_old: '',
    price_promo: '',
    
    // Склад та статус
    stock_quantity: '',
    available: true,
    state: 'new',
    
  });
  
  const [params, setParams] = useState<ProductParam[]>([]);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [categoryInput, setCategoryInput] = useState('');

  

  // Debug logging (removed stores logging)

  const productLimitQuery = useQuery({
    queryKey: ['user', uid, 'products', 'limit'],
    queryFn: async () => {
      return await ProductService.getProductLimit();
    },
    staleTime: 900_000,
    refetchOnWindowFocus: false,
    enabled: !product,
  });

  const loadProductData = useCallback(async () => {
    if (!product) return;
    
    try {
      setFormData({
        name: product.name || '',
        name_ua: product.name_ua || '',
        description: product.description || '',
        description_ua: product.description_ua || '',
        external_id: product.external_id || '',
        store_id: product.store_id || '',
        supplier_id: product.supplier_id || '',
        category_id: product.category_id || '',
        currency_id: product.currency_id || '',
        vendor: product.vendor || '',
        article: product.article || '',
        price: product.price?.toString() || '',
        price_old: product.price_old?.toString() || '',
        price_promo: product.price_promo?.toString() || '',
        stock_quantity: product.stock_quantity?.toString() || '',
        available: product.available ?? true,
        state: product.state || 'new'
      });

      // Load product params
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: paramsData } = await (supabase as any)
        .from('store_product_params')
        .select('*')
        .eq('product_id', product.id)
        .order('order_index');
      setParams(paramsData || []);

      // Load product images
      const imagesData = await ProductService.getProductImages(String(product.id));
      setImages((imagesData || []).map((img: any, index: number) => {
        const url = String(img?.url || "").trim();
        return {
          url,
          order_index: typeof img?.order_index === "number" ? img.order_index : index,
          is_main: !!img?.is_main,
          object_key: url ? (ImageHelpers.extractObjectKeyFromUrl(url) || undefined) : undefined,
        };
      }));
    } catch (error) {
      console.error('Load product data error:', error);
      toast.error('Помилка завантаження даних товару');
    }
  }, [product]);

  useEffect(() => {
    loadInitialData();
    if (product) {
      loadProductData();
    }
  }, [product, loadProductData]);

  const loadInitialData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user found');
        return;
      }
      
      // Removed stores loading and selection; ProductService will resolve store_id

      // Load suppliers
      const suppliersData = await SupplierService.getSuppliers();
      setSuppliers(suppliersData || []);

      // Load currencies from global currencies table
      const { data: currenciesData, error: currenciesError } = await (supabase as any)
        .from('currencies')
        .select('*')
        .eq('status', true)
        .order('name');
      
      if (currenciesError) {
        console.error('Error loading currencies:', currenciesError);
        setCurrencies([]);
      } else {
        setCurrencies(currenciesData || []);
      }

      // Categories will be loaded reactively based on selected supplier
      setCategories([]);
    } catch (error) {
      console.error('Load initial data error:', error);
    }
  };

  // Reactive categories fetch by supplier_id
  useEffect(() => {
    const fetchCategories = async (supplierId: string) => {
      try {
        const { data, error } = await (supabase as any)
          .from('store_categories')
          .select('*')
          .eq('supplier_id', supplierId)
          .order('name');
        if (error) {
          console.error('Error loading categories by supplier:', error);
          setCategories([]);
        } else {
          setCategories(data || []);
        }
      } catch (err) {
        console.error('Unexpected error loading categories:', err);
        setCategories([]);
      }
    };

    // Reset category selection whenever supplier changes
    setFormData(prev => ({ ...prev, category_id: '' }));

    if (formData.supplier_id) {
      fetchCategories(formData.supplier_id);
    } else {
      setCategories([]);
    }
     
  }, [formData.supplier_id]);

  const addParam = () => {
    setParams([...params, { name: '', value: '', order_index: params.length }]);
  };

  const removeParam = (index: number) => {
    setParams(params.filter((_, i) => i !== index));
  };

  const updateParam = (index: number, field: 'name' | 'value', value: string) => {
    const newParams = [...params];
    newParams[index][field] = value;
    setParams(newParams);
  };

  const addImageByUrl = async () => {
    if (!newImageUrl.trim()) {
      toast.error('Введіть URL зображення');
      return;
    }
    
    // Если редактируем существующий товар - загружаем через бэкенд с ресайзом
    if (product?.id) {
      try {
        setLoading(true);
        const result = await R2Storage.uploadProductImageFromUrl(product.id, newImageUrl.trim());
        setImages([...images, { 
          url: result.originalUrl,
          order_index: result.orderIndex,
          is_main: result.isMain,
          object_key: result.r2KeyOriginal,
        }]);
        setNewImageUrl('');
        toast.success('Зображення завантажено');
      } catch (error) {
        console.error('Upload from URL error:', error);
        toast.error('Помилка завантаження зображення за URL');
      } finally {
        setLoading(false);
      }
    } else {
      const u = newImageUrl.trim();
      const key = ImageHelpers.extractObjectKeyFromUrl(u);
      setImages([...images, { 
        url: u,
        order_index: images.length,
        is_main: images.length === 0,
        object_key: key || undefined,
      }]);
      setNewImageUrl('');
      toast.success('Зображення додано');
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const setMainImage = (index: number) => {
    const newImages = images.map((img, i) => ({
      ...img,
      is_main: i === index
    }));
    setImages(newImages);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Валидация типа и размера
    if (!file.type.startsWith('image/')) {
      toast.error('Оберіть файл зображення');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Розмір файлу не повинен перевищувати 10MB');
      return;
    }

    try {
      setLoading(true);
      
      // Если редактируем существующий товар - загружаем напрямую в R2 с ресайзом
      if (product?.id) {
        const result = await R2Storage.uploadProductImage(product.id, file);
        setImages([...images, {
          url: result.originalUrl,
          order_index: result.orderIndex,
          is_main: result.isMain,
          object_key: result.r2KeyOriginal,
        }]);
        
        toast.success('Зображення завантажено');
      } else {
        const resp = await R2Storage.uploadFile(file);
        setImages([...images, {
          url: resp.publicUrl,
          order_index: images.length,
          is_main: images.length === 0,
          object_key: resp.objectKey,
        }]);
        toast.success('Зображення завантажено');
      }
    } catch (error) {
      console.error('Upload error:', error);
      
      // Улучшенная обработка ошибок
      let errorMessage = 'Помилка завантаження зображення';
      if (error instanceof Error) {
        if (error.message.includes('unauthorized')) {
          errorMessage = 'Немає доступу для завантаження';
        } else if (error.message.includes('file_too_large')) {
          errorMessage = 'Розмір файлу не повинен перевищувати 10MB';
        } else if (error.message.includes('invalid_file_type')) {
          errorMessage = 'Оберіть файл зображення';
        } else if (error.message.includes('upload_failed') || error.message.includes('processing_failed')) {
          errorMessage = 'Помилка сервера при завантаженні';
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      // Очищаем input для возможности повторной загрузки того же файла
      event.target.value = '';
    }
  };

  const handleCategoryChange = (value: string) => {
    if (value === 'custom') {
      // Allow custom input
      setFormData({ ...formData, category_id: '' });
    } else {
      setFormData({ ...formData, category_id: value });
      setCategoryInput('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Назва товару обов\'язкова');
      return;
    }

    if (!formData.external_id) {
      toast.error('External ID обов\'язковий');
      return;
    }

    try {
      setLoading(true);

      // Check product limit before creating new product
      if (!product) {
        const limitInfo = productLimitQuery.data ?? await queryClient.fetchQuery({
          queryKey: ['user', uid, 'products', 'limit'],
          queryFn: async () => {
            return await ProductService.getProductLimit();
          },
          staleTime: 900_000,
        });
        if (!limitInfo.canCreate) {
          toast.error(`Досягнуто ліміт товарів: ${limitInfo.current}/${limitInfo.max}. Оновіть тарифний план для створення нових товарів.`);
          return;
        }
      }

      // Підготовуємо дані для створення товару
      const productData = {
        name: formData.name,
        name_ua: formData.name_ua || null,
        description: formData.description || null,
        description_ua: formData.description_ua || null,
        external_id: formData.external_id,
        supplier_id: formData.supplier_id || null,
        category_id: formData.category_id || null,
        currency_id: formData.currency_id || null,
        vendor: formData.vendor || null,
        article: formData.article || null,
        
        price: formData.price ? parseFloat(formData.price) : null,
        price_old: formData.price_old ? parseFloat(formData.price_old) : null,
        price_promo: formData.price_promo ? parseFloat(formData.price_promo) : null,
        stock_quantity: parseInt(formData.stock_quantity) || 0,
        available: formData.available,
        state: formData.state || 'active',
        params: params,
        images: images
      };

      let savedProduct;
      if (product) {
        savedProduct = await ProductService.updateProduct(product.id, productData);
        toast.success('Товар успішно оновлено');
      } else {
        savedProduct = await ProductService.createProduct(productData);
        queryClient.setQueryData(['user', uid, 'products', 'limit'], (old: any) => {
          if (!old) return old;
          const nextCurrent = Math.max(0, Number(old.current ?? 0) + 1);
          const max = Math.max(0, Number(old.max ?? 0));
          return { ...old, current: nextCurrent, canCreate: nextCurrent < max };
        });
        toast.success('Товар успішно створено');
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Save product error:', error);
      toast.error('Помилка збереження товару');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Основна інформація</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Назва товару (рос.) *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Введіть назву товару російською"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name_ua">Назва товару (укр.)</Label>
                  <Input
                    id="name_ua"
                    value={formData.name_ua}
                    onChange={(e) => setFormData({ ...formData, name_ua: e.target.value })}
                    placeholder="Введіть назву товару українською"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Опис товару (рос.)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Введіть опис товару російською"
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description_ua">Опис товару (укр.)</Label>
                <Textarea
                  id="description_ua"
                  value={formData.description_ua}
                  onChange={(e) => setFormData({ ...formData, description_ua: e.target.value })}
                  placeholder="Введіть опис товару українською"
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="external_id">External ID *</Label>
                  <Input
                    id="external_id"
                    value={formData.external_id}
                    onChange={(e) => setFormData({ ...formData, external_id: e.target.value })}
                    placeholder="Введіть External ID"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="article">Артикул</Label>
                  <Input
                    id="article"
                    value={formData.article}
                    onChange={(e) => setFormData({ ...formData, article: e.target.value })}
                    placeholder="Введіть артикул"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vendor">Виробник</Label>
                  <Input
                    id="vendor"
                    value={formData.vendor}
                    onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                    placeholder="Введіть виробника"
                  />
                </div>
                
              </div>

              {/* URL field removed per requirements */}
            </CardContent>
          </Card>

          {/* Product Images */}
          <Card>
            <CardHeader>
              <CardTitle>Зображення товару</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add image by URL */}
              <div className="flex gap-2">
                <Input
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="Введіть URL зображення"
                  className="flex-1"
                />
                <Button type="button" onClick={addImageByUrl} size="sm" variant="outline">
                  <Link className="h-4 w-4 mr-2" />
                  Додати URL
                </Button>
              </div>

              {/* Upload image file */}
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="flex-1"
                />
                <Button type="button" size="sm" variant="outline" disabled>
                  <Upload className="h-4 w-4 mr-2" />
                  Завантажити
                </Button>
              </div>

              {/* Images list */}
              {images.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Зображення не додані
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {images.map((image, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={getImageUrl(image.url, IMAGE_SIZES.THUMB)}
                        alt={`Product ${index + 1}`}
                        className="w-full h-32 object-cover rounded border"
                      />
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                        <Button
                          type="button"
                          onClick={() => setMainImage(index)}
                          size="icon"
                          variant="ghost"
                          aria-label={image.is_main ? "Головне" : "Зробити головним"}
                          className={`rounded-md ${image.is_main ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-success text-primary-foreground hover:bg-success/90'}`}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          onClick={() => removeImage(index)}
                          size="icon"
                          variant="destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Product Parameters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Параметри товару
                <Button type="button" onClick={addParam} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Додати параметр
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {params.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Параметри не додані
                </p>
              ) : (
                <div className="space-y-3">
                  {params.map((param, index) => (
                    <div key={index} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Label htmlFor={`param-name-${index}`}>Назва</Label>
                        <Input
                          id={`param-name-${index}`}
                          value={param.name}
                          onChange={(e) => updateParam(index, 'name', e.target.value)}
                          placeholder="Назва параметру"
                        />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor={`param-value-${index}`}>Значення</Label>
                        <Input
                          id={`param-value-${index}`}
                          value={param.value}
                          onChange={(e) => updateParam(index, 'value', e.target.value)}
                          placeholder="Значення параметру"
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={() => removeParam(index)}
                        size="sm"
                        variant="outline"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Settings */}
        <div className="space-y-6">
          {/* Supplier */}
          <Card>
            <CardHeader>
              <CardTitle>Постачальник</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="supplier">Постачальник</Label>
                <Select
                  value={formData.supplier_id}
                  onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Оберіть постачальника" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.supplier_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Category */}
          <Card>
            <CardHeader>
              <CardTitle>Категорія</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category">Категорія</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={handleCategoryChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Оберіть категорію або введіть власну" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Ввести власну категорію</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {!formData.category_id && (
                <div className="space-y-2">
                  <Label htmlFor="category_input">Власна категорія</Label>
                  <Input
                    id="category_input"
                    value={categoryInput}
                    onChange={(e) => setCategoryInput(e.target.value)}
                    placeholder="Введіть назву категорії"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Price and Currency */}
          <Card>
            <CardHeader>
              <CardTitle>Ціни та валюта</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currency">Валюта</Label>
                <Select
                  value={formData.currency_id}
                  onValueChange={(value) => setFormData({ ...formData, currency_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Оберіть валюту" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((currency) => (
                      <SelectItem key={currency.id} value={currency.id}>
                        {currency.code} - {currency.name} ({currency.symbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Поточна ціна</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price_old">Стара ціна</Label>
                <Input
                  id="price_old"
                  type="number"
                  step="0.01"
                  value={formData.price_old}
                  onChange={(e) => setFormData({ ...formData, price_old: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price_promo">Акційна ціна</Label>
                <Input
                  id="price_promo"
                  type="number"
                  step="0.01"
                  value={formData.price_promo}
                  onChange={(e) => setFormData({ ...formData, price_promo: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </CardContent>
          </Card>

          {/* Stock and Status */}
          <Card>
            <CardHeader>
              <CardTitle>{t('prices_stock')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
            <Label htmlFor="stock_quantity">{t('stock_quantity')}</Label>
                <Input
                  id="stock_quantity"
                  type="number"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                  placeholder={t('stock_quantity_placeholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">{t('product_status')}</Label>
                <Select
                  value={formData.state}
                  onValueChange={(value) => setFormData({ ...formData, state: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_status')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">{t('status_new')}</SelectItem>
                    <SelectItem value="stock">{t('status_stock')}</SelectItem>
                    <SelectItem value="used">{t('status_used')}</SelectItem>
                    <SelectItem value="refurbished">{t('status_refurbished')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="available"
                  checked={formData.available}
                  onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="available">{t('product_available')}</Label>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {product ? t('edit_product') : t('create_product')}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                {t('cancel')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
};
