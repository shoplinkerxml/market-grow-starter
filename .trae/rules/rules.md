React Performance Rules
🎯 State Management
❌ НЕ делать
const [name, setName] = useState('');
const [email, setEmail] = useState('');
const [phone, setPhone] = useState('');
// ... 20+ useState
✅ Делать
const [formData, dispatch] = useReducer(reducer, initialState);
// или для простых форм
const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
Правило: Если больше 5 связанных состояний → используй useReducer или объединяй в объект.
***🔄 Callbacks & Memoization
❌ НЕ делать
const handleClick = () => { /* ... */ };
const handleChange = (e) => { /* ... */ };
// Пересоздаются каждый рендер
✅ Делать
const handleClick = useCallback(() => { /* ... */ }, [deps]);
const handleChange = useCallback((e) => { /* ... */ }, [deps]);
Правило: Все функции, передаваемые в props → оборачивай в useCallback.
***💾 Computed Values
❌ НЕ делать
const filtered = items.filter(x => x.active); // Каждый рендер!
const sorted = data.sort((a, b) => a.id - b.id);
✅ Делать
const filtered = useMemo(() => items.filter(x => x.active), [items]);
const sorted = useMemo(() => data.sort((a, b) => a.id - b.id), [data]);
Правило: Любые вычисления/фильтрации/сортировки → useMemo.
***🧩 Component Size
❌ НЕ делать
export const MegaForm = () => {
  // 800+ строк кода
  return (
    <div>
      {/* все табы, формы, модалки в одном компоненте */}
    </div>
  );
};
✅ Делать
export const ProductForm = () => {
  return (
    <Tabs>
      <BasicTab />
      <ImagesTab />
      <ParamsTab />
    </Tabs>
  );
};
const BasicTab = memo(({ data, onChange }) => { /* ... */ });
Правило: Один компонент = одна ответственность. Максимум 250-300 строк.
***🔌 Effects
❌ НЕ делать
useEffect(() => { loadStores(); }, []);
useEffect(() => { loadSuppliers(); }, []);
useEffect(() => { loadCurrencies(); }, []);
useEffect(() => { if (stores.length) setStore(stores[0]); }, [stores]);
✅ Делать
useEffect(() => {
  const init = async () => {
    const [stores, suppliers, currencies] = await Promise.all([
      loadStores(),
      loadSuppliers(),
      loadCurrencies()
    ]);
    setAllData({ stores, suppliers, currencies });
  };
  init();
}, []);
Правило: Объединяй связанные эффекты. Загружай данные параллельно через Promise.all.
***📡 Data Fetching
❌ НЕ делать
const [data, setData] = useState([]);
useEffect(() => {
  fetch('/api/data').then(r => r.json()).then(setData);
}, []);
✅ Делать
const { data, isLoading } = useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
  staleTime: 5 * 60 * 1000
});
Правило: Для API запросов → используй React Query / TanStack Query / SWR.
***🖼️ Lists & Images
❌ НЕ делать
<div>
  {images.map(img => <img src={img.url} />)}
  {/* 100+ изображений рендерятся сразу */}
</div>
✅ Делать
<div>
  {images.map(img => (
    <img src={img.url} loading="lazy" />
  ))}
</div>
// Или для 100+ элементов
<VirtualList items={images} />
Правило: 
Всегда добавляй loading="lazy" к изображениям
При 50+ элементах → используй виртуализацию (@tanstack/react-virtual)
***⚡ Input Optimization
❌ НЕ делать
<input onChange={(e) => setState(e.target.value)} />
// Ре-рендер на каждую клавишу
✅ Делать
const debouncedValue = useDebounce(value, 300);
// или
const deferredValue = useDeferredValue(value);
Правило: Для поисковых полей и фильтров → debounce или useDeferredValue.
***🎨 Re-render Prevention
❌ НЕ делать
<ChildComponent data={data} onSave={() => save()} />
// Новая функция каждый рендер → Child ре-рендерится
✅ Делать
const handleSave = useCallback(() => save(), []);
const MemoChild = memo(ChildComponent);
<MemoChild data={data} onSave={handleSave} />
Правило: Все тяжелые дочерние компоненты → оборачивай в memo.
***📦 Bundle Size
❌ НЕ делать
import * as THREE from 'three'; // 600KB в бандле
import * as lodash from 'lodash'; // 500KB
✅ Делать
import { Scene, Mesh } from 'three';
import debounce from 'lodash/debounce';
// или
const HeavyComponent = lazy(() => import('./Heavy'));
Правило: 
Импортируй только нужное
Компоненты 50KB+ → делай lazy
***🛡️ Cleanup
❌ НЕ делать
useEffect(() => {
  const interval = setInterval(() => tick(), 1000);
  // утечка памяти!
}, []);
✅ Делать
useEffect(() => {
  const interval = setInterval(() => tick(), 1000);
  return () => clearInterval(interval);
}, []);
Правило: Любая подписка/таймер/listener → обязательно cleanup в return.
***📊 Checklist перед коммитом
Компонент < 300 строк?
Нет больше 5 useState подряд?
Все функции в props обернуты в useCallback?
Тяжелые вычисления в useMemo?
Изображения с loading="lazy"?
Нет useEffect без cleanup?
API запросы через React Query?
Дочерние компоненты обернуты в memo?
***🔥 Золотое правило
> Если сомневаешься → профилируй через React DevTools Profiler  
> Не оптимизируй заранее, но следуй базовым правилам выше.