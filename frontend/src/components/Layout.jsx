import { theme } from '../config/theme';
import Header from './Header';
import Sidebar from './Sidebar';

const layoutStyles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: theme.colors.background,
  },
  main: {
    flex: 1,
    minWidth: 0,  // erlaubt inneren overflow-Containern (z.B. breite Tabellen) zu scrollen, statt den Viewport zu sprengen
    marginLeft: theme.layout.sidebarWidth,
    marginTop: theme.layout.headerHeight,
    display: 'flex',
    flexDirection: 'column',
  },
  content: {
    flex: 1,
    minWidth: 0,
    padding: theme.spacing.xl,
    display: 'flex',
    flexDirection: 'column',
  },
};

function Layout({ children }) {
  return (
    <div style={layoutStyles.container}>
      <Sidebar />
      <Header />
      <main style={layoutStyles.main}>
        <div style={layoutStyles.content}>
          {children}
        </div>
      </main>
    </div>
  );
}

export default Layout;
