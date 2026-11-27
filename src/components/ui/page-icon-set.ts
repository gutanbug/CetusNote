// 이 파일은 고른 lucide 아이콘 모음이다 (PAGE-10). 이름 · 컴포넌트 · 한국어 검색어.
// 아이콘을 더하려면 카테고리 목록에 한 줄을 넣는다. 저장된 이름이 빠지면 그 페이지 아이콘은 그려지지 않으니 지우지 않는다.
import {
  AlarmClock,
  Anchor,
  Apple,
  Archive,
  ArrowRight,
  ArrowUpRight,
  Asterisk,
  AtSign,
  Atom,
  Award,
  Baby,
  Banknote,
  Bath,
  Bed,
  Beef,
  Beer,
  Bell,
  Bike,
  Bird,
  Book,
  BookOpen,
  Bookmark,
  Bot,
  Brain,
  Briefcase,
  Brush,
  Bug,
  Building,
  Building2,
  Bus,
  Cake,
  Calculator,
  Calendar,
  CalendarCheck,
  CalendarDays,
  Camera,
  Candy,
  Car,
  Carrot,
  Castle,
  Cat,
  ChartColumn,
  ChartLine,
  ChartPie,
  Check,
  ChefHat,
  Cherry,
  Circle,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Clapperboard,
  Clipboard,
  ClipboardList,
  Clock,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudSun,
  Code,
  CodeXml,
  Coffee,
  Coins,
  Compass,
  Cookie,
  CookingPot,
  Cpu,
  CreditCard,
  Croissant,
  Crown,
  CupSoda,
  Database,
  Diamond,
  Dice5,
  Dog,
  Drama,
  Droplet,
  Dumbbell,
  Earth,
  Egg,
  Eye,
  Feather,
  File,
  FileCode,
  FileText,
  Files,
  Film,
  Fish,
  Flag,
  Flame,
  FlaskConical,
  Flower,
  Flower2,
  Folder,
  FolderOpen,
  Footprints,
  Fuel,
  Gamepad2,
  Gem,
  Gift,
  GitBranch,
  GitPullRequest,
  Glasses,
  Globe,
  GraduationCap,
  Guitar,
  Hammer,
  Handshake,
  HardDrive,
  Hash,
  Heading,
  Headphones,
  Heart,
  HeartPulse,
  Hexagon,
  Highlighter,
  Hospital,
  Hotel,
  Hourglass,
  House,
  IceCreamCone,
  Image,
  Inbox,
  Infinity as InfinityIcon,
  Info,
  Kanban,
  Key,
  Keyboard,
  Lamp,
  Landmark,
  Languages,
  Laptop,
  LayoutDashboard,
  Leaf,
  Library,
  Lightbulb,
  Link,
  ListChecks,
  ListTodo,
  Lock,
  Luggage,
  Mail,
  Map as MapIcon,
  MapPin,
  Medal,
  Megaphone,
  MessageCircle,
  Mic,
  Microscope,
  Milestone,
  Milk,
  Minus,
  Monitor,
  Moon,
  Mountain,
  Mouse,
  Music,
  Newspaper,
  Notebook,
  NotebookPen,
  Palette,
  Paperclip,
  PartyPopper,
  PawPrint,
  Pen,
  Pencil,
  PencilRuler,
  Percent,
  Phone,
  Piano,
  PiggyBank,
  Pill,
  Pin,
  Pizza,
  Plane,
  Plus,
  Popcorn,
  Presentation,
  Puzzle,
  Quote,
  Rabbit,
  Rainbow,
  Receipt,
  RefreshCw,
  Repeat,
  Rocket,
  Sailboat,
  Salad,
  Sandwich,
  Satellite,
  School,
  Scissors,
  Scroll,
  Send,
  Server,
  Settings,
  Shell,
  Shield,
  Ship,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Signature,
  Smartphone,
  Smile,
  Snowflake,
  Sofa,
  Soup,
  Sparkle,
  Sparkles,
  Sprout,
  Square,
  Squirrel,
  Star,
  Stethoscope,
  StickyNote,
  Store,
  Sun,
  Sunrise,
  Sunset,
  Tag,
  Tags,
  Target,
  Tent,
  Terminal,
  ThumbsDown,
  ThumbsUp,
  Ticket,
  Timer,
  TrainFront,
  TreePine,
  Trees,
  TrendingUp,
  Triangle,
  TriangleAlert,
  Trophy,
  Turtle,
  Tv,
  Type,
  Umbrella,
  User,
  Users,
  Utensils,
  Video,
  Wallet,
  Watch,
  Waves,
  Wifi,
  Wind,
  Wine,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { SOFT_COLORS, type SoftColor } from "./tag-chip";

type PageIconEntry = { name: string; Icon: LucideIcon; keywords: string };
type PageIconCategory = { id: string; name: string; icons: PageIconEntry[] };

const PAGE_ICON_CATEGORIES: PageIconCategory[] = [
  {
    id: "docs",
    name: "문서·글", // i18n-ignore
    icons: [
      { name: "file-text", Icon: FileText, keywords: "문서 페이지" }, // i18n-ignore
      { name: "notebook", Icon: Notebook, keywords: "노트 공책" }, // i18n-ignore
      { name: "notebook-pen", Icon: NotebookPen, keywords: "필기 노트" }, // i18n-ignore
      { name: "book", Icon: Book, keywords: "책" }, // i18n-ignore
      { name: "book-open", Icon: BookOpen, keywords: "독서 책 읽기" }, // i18n-ignore
      { name: "bookmark", Icon: Bookmark, keywords: "북마크 책갈피" }, // i18n-ignore
      { name: "library", Icon: Library, keywords: "서재 도서관" }, // i18n-ignore
      { name: "newspaper", Icon: Newspaper, keywords: "신문 뉴스" }, // i18n-ignore
      { name: "scroll", Icon: Scroll, keywords: "두루마리 기록" }, // i18n-ignore
      { name: "sticky-note", Icon: StickyNote, keywords: "메모 포스트잇" }, // i18n-ignore
      { name: "clipboard", Icon: Clipboard, keywords: "클립보드" }, // i18n-ignore
      { name: "clipboard-list", Icon: ClipboardList, keywords: "목록 체크리스트" }, // i18n-ignore
      { name: "list-todo", Icon: ListTodo, keywords: "할 일 목록" }, // i18n-ignore
      { name: "list-checks", Icon: ListChecks, keywords: "체크 목록" }, // i18n-ignore
      { name: "pen", Icon: Pen, keywords: "펜 쓰기" }, // i18n-ignore
      { name: "pencil", Icon: Pencil, keywords: "연필 쓰기" }, // i18n-ignore
      { name: "highlighter", Icon: Highlighter, keywords: "형광펜 강조" }, // i18n-ignore
      { name: "quote", Icon: Quote, keywords: "인용" }, // i18n-ignore
      { name: "type", Icon: Type, keywords: "글자 텍스트" }, // i18n-ignore
      { name: "heading", Icon: Heading, keywords: "제목" }, // i18n-ignore
      { name: "archive", Icon: Archive, keywords: "보관" }, // i18n-ignore
      { name: "folder", Icon: Folder, keywords: "폴더" }, // i18n-ignore
      { name: "folder-open", Icon: FolderOpen, keywords: "폴더 열기" }, // i18n-ignore
      { name: "inbox", Icon: Inbox, keywords: "받은편지함 수신함" }, // i18n-ignore
      { name: "paperclip", Icon: Paperclip, keywords: "첨부 클립" }, // i18n-ignore
      { name: "file", Icon: File, keywords: "파일" }, // i18n-ignore
      { name: "files", Icon: Files, keywords: "파일들" }, // i18n-ignore
      { name: "file-code", Icon: FileCode, keywords: "코드 파일" }, // i18n-ignore
      { name: "signature", Icon: Signature, keywords: "서명" }, // i18n-ignore
    ],
  },
  {
    id: "work",
    name: "일·업무", // i18n-ignore
    icons: [
      { name: "briefcase", Icon: Briefcase, keywords: "업무 가방 일" }, // i18n-ignore
      { name: "calendar", Icon: Calendar, keywords: "달력 일정" }, // i18n-ignore
      { name: "calendar-days", Icon: CalendarDays, keywords: "날짜 달력 일정" }, // i18n-ignore
      { name: "calendar-check", Icon: CalendarCheck, keywords: "일정 완료" }, // i18n-ignore
      { name: "clock", Icon: Clock, keywords: "시계 시간" }, // i18n-ignore
      { name: "alarm-clock", Icon: AlarmClock, keywords: "알람" }, // i18n-ignore
      { name: "timer", Icon: Timer, keywords: "타이머" }, // i18n-ignore
      { name: "hourglass", Icon: Hourglass, keywords: "모래시계 대기" }, // i18n-ignore
      { name: "target", Icon: Target, keywords: "목표 과녁" }, // i18n-ignore
      { name: "flag", Icon: Flag, keywords: "깃발 마감" }, // i18n-ignore
      { name: "milestone", Icon: Milestone, keywords: "이정표" }, // i18n-ignore
      { name: "trophy", Icon: Trophy, keywords: "트로피 우승" }, // i18n-ignore
      { name: "award", Icon: Award, keywords: "상 수상" }, // i18n-ignore
      { name: "chart-line", Icon: ChartLine, keywords: "차트 그래프" }, // i18n-ignore
      { name: "chart-column", Icon: ChartColumn, keywords: "막대 차트" }, // i18n-ignore
      { name: "chart-pie", Icon: ChartPie, keywords: "원형 차트" }, // i18n-ignore
      { name: "trending-up", Icon: TrendingUp, keywords: "성장 상승" }, // i18n-ignore
      { name: "kanban", Icon: Kanban, keywords: "칸반 보드" }, // i18n-ignore
      { name: "layout-dashboard", Icon: LayoutDashboard, keywords: "대시보드" }, // i18n-ignore
      { name: "users", Icon: Users, keywords: "사람들 팀" }, // i18n-ignore
      { name: "user", Icon: User, keywords: "사람 개인" }, // i18n-ignore
      { name: "handshake", Icon: Handshake, keywords: "협업 악수 계약" }, // i18n-ignore
      { name: "building", Icon: Building, keywords: "회사 건물" }, // i18n-ignore
      { name: "building-2", Icon: Building2, keywords: "사무실 건물" }, // i18n-ignore
      { name: "landmark", Icon: Landmark, keywords: "기관 은행" }, // i18n-ignore
      { name: "mail", Icon: Mail, keywords: "메일 편지" }, // i18n-ignore
      { name: "send", Icon: Send, keywords: "보내기" }, // i18n-ignore
      { name: "phone", Icon: Phone, keywords: "전화" }, // i18n-ignore
      { name: "message-circle", Icon: MessageCircle, keywords: "메시지 대화" }, // i18n-ignore
      { name: "megaphone", Icon: Megaphone, keywords: "공지 홍보" }, // i18n-ignore
      { name: "mic", Icon: Mic, keywords: "마이크 녹음" }, // i18n-ignore
      { name: "video", Icon: Video, keywords: "화상 영상" }, // i18n-ignore
      { name: "presentation", Icon: Presentation, keywords: "발표" }, // i18n-ignore
    ],
  },
  {
    id: "tech",
    name: "개발·기술", // i18n-ignore
    icons: [
      { name: "code", Icon: Code, keywords: "코드 개발" }, // i18n-ignore
      { name: "code-xml", Icon: CodeXml, keywords: "코드 태그" }, // i18n-ignore
      { name: "terminal", Icon: Terminal, keywords: "터미널 명령" }, // i18n-ignore
      { name: "bug", Icon: Bug, keywords: "버그 벌레" }, // i18n-ignore
      { name: "git-branch", Icon: GitBranch, keywords: "브랜치 깃" }, // i18n-ignore
      { name: "git-pull-request", Icon: GitPullRequest, keywords: "풀 리퀘스트" }, // i18n-ignore
      { name: "database", Icon: Database, keywords: "데이터베이스" }, // i18n-ignore
      { name: "server", Icon: Server, keywords: "서버" }, // i18n-ignore
      { name: "cloud", Icon: Cloud, keywords: "클라우드 구름" }, // i18n-ignore
      { name: "cpu", Icon: Cpu, keywords: "칩 프로세서" }, // i18n-ignore
      { name: "hard-drive", Icon: HardDrive, keywords: "저장 장치" }, // i18n-ignore
      { name: "laptop", Icon: Laptop, keywords: "노트북 컴퓨터" }, // i18n-ignore
      { name: "monitor", Icon: Monitor, keywords: "모니터 화면" }, // i18n-ignore
      { name: "smartphone", Icon: Smartphone, keywords: "휴대폰 모바일" }, // i18n-ignore
      { name: "keyboard", Icon: Keyboard, keywords: "키보드" }, // i18n-ignore
      { name: "mouse", Icon: Mouse, keywords: "마우스" }, // i18n-ignore
      { name: "wifi", Icon: Wifi, keywords: "와이파이 네트워크" }, // i18n-ignore
      { name: "globe", Icon: Globe, keywords: "웹 세계 인터넷" }, // i18n-ignore
      { name: "link", Icon: Link, keywords: "링크 연결" }, // i18n-ignore
      { name: "key", Icon: Key, keywords: "열쇠 키" }, // i18n-ignore
      { name: "lock", Icon: Lock, keywords: "잠금 비밀" }, // i18n-ignore
      { name: "shield", Icon: Shield, keywords: "보안 방패" }, // i18n-ignore
      { name: "settings", Icon: Settings, keywords: "설정 톱니" }, // i18n-ignore
      { name: "wrench", Icon: Wrench, keywords: "도구 수리" }, // i18n-ignore
      { name: "hammer", Icon: Hammer, keywords: "망치 만들기" }, // i18n-ignore
      { name: "puzzle", Icon: Puzzle, keywords: "퍼즐 조각" }, // i18n-ignore
      { name: "bot", Icon: Bot, keywords: "봇 로봇" }, // i18n-ignore
      { name: "brain", Icon: Brain, keywords: "뇌 생각" }, // i18n-ignore
      { name: "sparkles", Icon: Sparkles, keywords: "반짝 AI" }, // i18n-ignore
      { name: "zap", Icon: Zap, keywords: "번개 빠름" }, // i18n-ignore
      { name: "rocket", Icon: Rocket, keywords: "로켓 출시" }, // i18n-ignore
      { name: "satellite", Icon: Satellite, keywords: "위성" }, // i18n-ignore
      { name: "atom", Icon: Atom, keywords: "원자 과학" }, // i18n-ignore
      { name: "flask-conical", Icon: FlaskConical, keywords: "실험 플라스크" }, // i18n-ignore
      { name: "microscope", Icon: Microscope, keywords: "현미경 연구" }, // i18n-ignore
    ],
  },
  {
    id: "life",
    name: "생활", // i18n-ignore
    icons: [
      { name: "house", Icon: House, keywords: "집 홈" }, // i18n-ignore
      { name: "bed", Icon: Bed, keywords: "침대 잠" }, // i18n-ignore
      { name: "bath", Icon: Bath, keywords: "목욕 욕실" }, // i18n-ignore
      { name: "sofa", Icon: Sofa, keywords: "소파 휴식" }, // i18n-ignore
      { name: "lamp", Icon: Lamp, keywords: "조명 램프" }, // i18n-ignore
      { name: "shopping-cart", Icon: ShoppingCart, keywords: "장보기 카트" }, // i18n-ignore
      { name: "shopping-bag", Icon: ShoppingBag, keywords: "쇼핑" }, // i18n-ignore
      { name: "gift", Icon: Gift, keywords: "선물" }, // i18n-ignore
      { name: "wallet", Icon: Wallet, keywords: "지갑" }, // i18n-ignore
      { name: "credit-card", Icon: CreditCard, keywords: "카드 결제" }, // i18n-ignore
      { name: "piggy-bank", Icon: PiggyBank, keywords: "저축 돼지 저금통" }, // i18n-ignore
      { name: "receipt", Icon: Receipt, keywords: "영수증" }, // i18n-ignore
      { name: "coins", Icon: Coins, keywords: "돈 동전" }, // i18n-ignore
      { name: "banknote", Icon: Banknote, keywords: "지폐 돈" }, // i18n-ignore
      { name: "heart", Icon: Heart, keywords: "하트 좋아요 사랑" }, // i18n-ignore
      { name: "star", Icon: Star, keywords: "별 중요" }, // i18n-ignore
      { name: "smile", Icon: Smile, keywords: "웃음 기분" }, // i18n-ignore
      { name: "baby", Icon: Baby, keywords: "아기" }, // i18n-ignore
      { name: "dog", Icon: Dog, keywords: "강아지 개" }, // i18n-ignore
      { name: "cat", Icon: Cat, keywords: "고양이" }, // i18n-ignore
      { name: "paw-print", Icon: PawPrint, keywords: "발자국 반려동물" }, // i18n-ignore
      { name: "shirt", Icon: Shirt, keywords: "옷 셔츠" }, // i18n-ignore
      { name: "scissors", Icon: Scissors, keywords: "가위" }, // i18n-ignore
      { name: "umbrella", Icon: Umbrella, keywords: "우산" }, // i18n-ignore
      { name: "glasses", Icon: Glasses, keywords: "안경" }, // i18n-ignore
      { name: "watch", Icon: Watch, keywords: "손목시계" }, // i18n-ignore
      { name: "pill", Icon: Pill, keywords: "약" }, // i18n-ignore
      { name: "stethoscope", Icon: Stethoscope, keywords: "병원 진료" }, // i18n-ignore
      { name: "heart-pulse", Icon: HeartPulse, keywords: "건강 심장" }, // i18n-ignore
      { name: "dumbbell", Icon: Dumbbell, keywords: "운동 헬스" }, // i18n-ignore
      { name: "bike", Icon: Bike, keywords: "자전거" }, // i18n-ignore
      { name: "footprints", Icon: Footprints, keywords: "걷기 발자국" }, // i18n-ignore
    ],
  },
  {
    id: "food",
    name: "음식", // i18n-ignore
    icons: [
      { name: "coffee", Icon: Coffee, keywords: "커피 카페" }, // i18n-ignore
      { name: "cup-soda", Icon: CupSoda, keywords: "음료" }, // i18n-ignore
      { name: "wine", Icon: Wine, keywords: "와인 술" }, // i18n-ignore
      { name: "beer", Icon: Beer, keywords: "맥주 술" }, // i18n-ignore
      { name: "utensils", Icon: Utensils, keywords: "식사 밥" }, // i18n-ignore
      { name: "chef-hat", Icon: ChefHat, keywords: "요리 셰프" }, // i18n-ignore
      { name: "cooking-pot", Icon: CookingPot, keywords: "냄비 요리" }, // i18n-ignore
      { name: "pizza", Icon: Pizza, keywords: "피자" }, // i18n-ignore
      { name: "sandwich", Icon: Sandwich, keywords: "샌드위치" }, // i18n-ignore
      { name: "salad", Icon: Salad, keywords: "샐러드" }, // i18n-ignore
      { name: "soup", Icon: Soup, keywords: "국 수프" }, // i18n-ignore
      { name: "apple", Icon: Apple, keywords: "사과 과일" }, // i18n-ignore
      { name: "cherry", Icon: Cherry, keywords: "체리 과일" }, // i18n-ignore
      { name: "carrot", Icon: Carrot, keywords: "당근 채소" }, // i18n-ignore
      { name: "croissant", Icon: Croissant, keywords: "빵 크루아상" }, // i18n-ignore
      { name: "cake", Icon: Cake, keywords: "케이크 생일" }, // i18n-ignore
      { name: "cookie", Icon: Cookie, keywords: "쿠키 과자" }, // i18n-ignore
      { name: "ice-cream-cone", Icon: IceCreamCone, keywords: "아이스크림" }, // i18n-ignore
      { name: "egg", Icon: Egg, keywords: "달걀" }, // i18n-ignore
      { name: "fish", Icon: Fish, keywords: "생선 물고기" }, // i18n-ignore
      { name: "beef", Icon: Beef, keywords: "고기" }, // i18n-ignore
      { name: "milk", Icon: Milk, keywords: "우유" }, // i18n-ignore
      { name: "candy", Icon: Candy, keywords: "사탕" }, // i18n-ignore
      { name: "popcorn", Icon: Popcorn, keywords: "팝콘" }, // i18n-ignore
    ],
  },
  {
    id: "nature",
    name: "자연·날씨", // i18n-ignore
    icons: [
      { name: "sun", Icon: Sun, keywords: "해 맑음 낮" }, // i18n-ignore
      { name: "moon", Icon: Moon, keywords: "달 밤" }, // i18n-ignore
      { name: "cloud-sun", Icon: CloudSun, keywords: "구름 흐림" }, // i18n-ignore
      { name: "cloud-rain", Icon: CloudRain, keywords: "비" }, // i18n-ignore
      { name: "cloud-snow", Icon: CloudSnow, keywords: "눈" }, // i18n-ignore
      { name: "snowflake", Icon: Snowflake, keywords: "눈송이 겨울" }, // i18n-ignore
      { name: "wind", Icon: Wind, keywords: "바람" }, // i18n-ignore
      { name: "rainbow", Icon: Rainbow, keywords: "무지개" }, // i18n-ignore
      { name: "leaf", Icon: Leaf, keywords: "잎 나뭇잎" }, // i18n-ignore
      { name: "sprout", Icon: Sprout, keywords: "새싹 성장" }, // i18n-ignore
      { name: "tree-pine", Icon: TreePine, keywords: "나무 소나무" }, // i18n-ignore
      { name: "trees", Icon: Trees, keywords: "숲 나무" }, // i18n-ignore
      { name: "flower", Icon: Flower, keywords: "꽃" }, // i18n-ignore
      { name: "flower-2", Icon: Flower2, keywords: "꽃송이 꽃" }, // i18n-ignore
      { name: "mountain", Icon: Mountain, keywords: "산" }, // i18n-ignore
      { name: "waves", Icon: Waves, keywords: "파도 바다" }, // i18n-ignore
      { name: "droplet", Icon: Droplet, keywords: "물방울 물" }, // i18n-ignore
      { name: "flame", Icon: Flame, keywords: "불 열정" }, // i18n-ignore
      { name: "sunrise", Icon: Sunrise, keywords: "일출 아침" }, // i18n-ignore
      { name: "sunset", Icon: Sunset, keywords: "일몰 저녁" }, // i18n-ignore
      { name: "earth", Icon: Earth, keywords: "지구" }, // i18n-ignore
      { name: "bird", Icon: Bird, keywords: "새" }, // i18n-ignore
      { name: "rabbit", Icon: Rabbit, keywords: "토끼" }, // i18n-ignore
      { name: "turtle", Icon: Turtle, keywords: "거북이" }, // i18n-ignore
      { name: "squirrel", Icon: Squirrel, keywords: "다람쥐" }, // i18n-ignore
      { name: "shell", Icon: Shell, keywords: "조개 바다" }, // i18n-ignore
      { name: "feather", Icon: Feather, keywords: "깃털" }, // i18n-ignore
    ],
  },
  {
    id: "travel",
    name: "여행·장소", // i18n-ignore
    icons: [
      { name: "map", Icon: MapIcon, keywords: "지도" }, // i18n-ignore
      { name: "map-pin", Icon: MapPin, keywords: "위치 장소" }, // i18n-ignore
      { name: "compass", Icon: Compass, keywords: "나침반 방향" }, // i18n-ignore
      { name: "plane", Icon: Plane, keywords: "비행기 여행" }, // i18n-ignore
      { name: "train-front", Icon: TrainFront, keywords: "기차" }, // i18n-ignore
      { name: "bus", Icon: Bus, keywords: "버스" }, // i18n-ignore
      { name: "car", Icon: Car, keywords: "자동차" }, // i18n-ignore
      { name: "ship", Icon: Ship, keywords: "배" }, // i18n-ignore
      { name: "sailboat", Icon: Sailboat, keywords: "요트 배" }, // i18n-ignore
      { name: "tent", Icon: Tent, keywords: "캠핑 텐트" }, // i18n-ignore
      { name: "luggage", Icon: Luggage, keywords: "짐 여행가방" }, // i18n-ignore
      { name: "ticket", Icon: Ticket, keywords: "티켓 표" }, // i18n-ignore
      { name: "hotel", Icon: Hotel, keywords: "호텔 숙소" }, // i18n-ignore
      { name: "castle", Icon: Castle, keywords: "성" }, // i18n-ignore
      { name: "store", Icon: Store, keywords: "가게 상점" }, // i18n-ignore
      { name: "school", Icon: School, keywords: "학교" }, // i18n-ignore
      { name: "hospital", Icon: Hospital, keywords: "병원" }, // i18n-ignore
      { name: "anchor", Icon: Anchor, keywords: "닻 항구" }, // i18n-ignore
      { name: "fuel", Icon: Fuel, keywords: "주유" }, // i18n-ignore
    ],
  },
  {
    id: "hobby",
    name: "취미·배움", // i18n-ignore
    icons: [
      { name: "music", Icon: Music, keywords: "음악" }, // i18n-ignore
      { name: "headphones", Icon: Headphones, keywords: "헤드폰 음악" }, // i18n-ignore
      { name: "guitar", Icon: Guitar, keywords: "기타 악기" }, // i18n-ignore
      { name: "piano", Icon: Piano, keywords: "피아노 악기" }, // i18n-ignore
      { name: "camera", Icon: Camera, keywords: "카메라 사진" }, // i18n-ignore
      { name: "image", Icon: Image, keywords: "이미지 사진" }, // i18n-ignore
      { name: "film", Icon: Film, keywords: "영화 필름" }, // i18n-ignore
      { name: "clapperboard", Icon: Clapperboard, keywords: "영상 촬영" }, // i18n-ignore
      { name: "tv", Icon: Tv, keywords: "텔레비전 티비" }, // i18n-ignore
      { name: "gamepad-2", Icon: Gamepad2, keywords: "게임" }, // i18n-ignore
      { name: "dice-5", Icon: Dice5, keywords: "주사위 보드게임" }, // i18n-ignore
      { name: "palette", Icon: Palette, keywords: "그림 팔레트 색" }, // i18n-ignore
      { name: "brush", Icon: Brush, keywords: "붓 그림" }, // i18n-ignore
      { name: "drama", Icon: Drama, keywords: "연극 공연" }, // i18n-ignore
      { name: "graduation-cap", Icon: GraduationCap, keywords: "졸업 학습 공부" }, // i18n-ignore
      { name: "pencil-ruler", Icon: PencilRuler, keywords: "공부 설계" }, // i18n-ignore
      { name: "calculator", Icon: Calculator, keywords: "계산기" }, // i18n-ignore
      { name: "languages", Icon: Languages, keywords: "언어 번역" }, // i18n-ignore
      { name: "lightbulb", Icon: Lightbulb, keywords: "아이디어 전구" }, // i18n-ignore
      { name: "crown", Icon: Crown, keywords: "왕관" }, // i18n-ignore
      { name: "gem", Icon: Gem, keywords: "보석" }, // i18n-ignore
      { name: "medal", Icon: Medal, keywords: "메달" }, // i18n-ignore
      { name: "party-popper", Icon: PartyPopper, keywords: "파티 축하" }, // i18n-ignore
    ],
  },
  {
    id: "symbols",
    name: "기호·모양", // i18n-ignore
    icons: [
      { name: "circle", Icon: Circle, keywords: "원 동그라미" }, // i18n-ignore
      { name: "square", Icon: Square, keywords: "사각형 네모" }, // i18n-ignore
      { name: "triangle", Icon: Triangle, keywords: "삼각형 세모" }, // i18n-ignore
      { name: "diamond", Icon: Diamond, keywords: "다이아몬드 마름모" }, // i18n-ignore
      { name: "hexagon", Icon: Hexagon, keywords: "육각형" }, // i18n-ignore
      { name: "check", Icon: Check, keywords: "체크 확인" }, // i18n-ignore
      { name: "circle-check", Icon: CircleCheck, keywords: "완료 확인" }, // i18n-ignore
      { name: "x", Icon: X, keywords: "닫기 엑스" }, // i18n-ignore
      { name: "plus", Icon: Plus, keywords: "더하기 추가" }, // i18n-ignore
      { name: "minus", Icon: Minus, keywords: "빼기" }, // i18n-ignore
      { name: "info", Icon: Info, keywords: "정보" }, // i18n-ignore
      { name: "circle-alert", Icon: CircleAlert, keywords: "경고 알림" }, // i18n-ignore
      { name: "triangle-alert", Icon: TriangleAlert, keywords: "주의 경고" }, // i18n-ignore
      { name: "circle-help", Icon: CircleHelp, keywords: "질문 도움" }, // i18n-ignore
      { name: "bell", Icon: Bell, keywords: "알림 종" }, // i18n-ignore
      { name: "eye", Icon: Eye, keywords: "보기 눈" }, // i18n-ignore
      { name: "hash", Icon: Hash, keywords: "해시 번호" }, // i18n-ignore
      { name: "at-sign", Icon: AtSign, keywords: "골뱅이 멘션" }, // i18n-ignore
      { name: "infinity", Icon: InfinityIcon, keywords: "무한" }, // i18n-ignore
      { name: "asterisk", Icon: Asterisk, keywords: "별표" }, // i18n-ignore
      { name: "percent", Icon: Percent, keywords: "퍼센트" }, // i18n-ignore
      { name: "arrow-right", Icon: ArrowRight, keywords: "화살표 오른쪽" }, // i18n-ignore
      { name: "arrow-up-right", Icon: ArrowUpRight, keywords: "화살표 바로가기" }, // i18n-ignore
      { name: "refresh-cw", Icon: RefreshCw, keywords: "새로고침 반복" }, // i18n-ignore
      { name: "repeat", Icon: Repeat, keywords: "반복" }, // i18n-ignore
      { name: "tag", Icon: Tag, keywords: "태그" }, // i18n-ignore
      { name: "tags", Icon: Tags, keywords: "태그들" }, // i18n-ignore
      { name: "pin", Icon: Pin, keywords: "핀 고정" }, // i18n-ignore
      { name: "thumbs-up", Icon: ThumbsUp, keywords: "좋아요" }, // i18n-ignore
      { name: "thumbs-down", Icon: ThumbsDown, keywords: "싫어요" }, // i18n-ignore
      { name: "sparkle", Icon: Sparkle, keywords: "반짝" }, // i18n-ignore
    ],
  },
];

/** 이름 → 아이콘 */
const PAGE_ICONS: ReadonlyMap<string, PageIconEntry> = new Map(
  PAGE_ICON_CATEGORIES.flatMap((c) => c.icons.map((i) => [i.name, i] as const)),
);

/** 아이콘 색 — 기본(보조 글자색) + 소프트 컬러 9종의 글자색 */
const ICON_COLOR: Record<SoftColor, string> = {
  gray: "text-gray-fg",
  brown: "text-brown-fg",
  orange: "text-orange-fg",
  yellow: "text-yellow-fg",
  green: "text-green-fg",
  blue: "text-blue-fg",
  purple: "text-purple-fg",
  pink: "text-pink-fg",
  red: "text-red-fg",
};
const iconColorClass = (color: string | null) =>
  color && (SOFT_COLORS as readonly string[]).includes(color)
    ? ICON_COLOR[color as SoftColor]
    : "text-secondary";

export {
  iconColorClass,
  PAGE_ICON_CATEGORIES,
  PAGE_ICONS,
  type PageIconCategory,
  type PageIconEntry,
};
