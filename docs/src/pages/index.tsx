import type { ReactNode } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '../components/HomepageFeatures';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <div className={styles.heroGrid}>
          <div className={styles.heroContent}>
            <p className={styles.kicker}>Developer platform reference</p>
            <Heading as="h1" className="hero__title">
              {siteConfig.title}
            </Heading>
            <p className={clsx('hero__subtitle', styles.heroSubtitle)}>
              {siteConfig.tagline}
            </p>
            <p className={styles.heroBody}>
              This site is the front door into the IDP: how the platform thinks
              about applications, environments, ownership, operations, and the
              shared guardrails that shape everyday developer work. It should
              feel less like a static manual and more like a guided introduction
              to the operating model behind the console.
            </p>
            <div className={styles.buttons}>
              <Link
                className={clsx(
                  'button button--primary button--lg',
                  styles.primaryButton
                )}
                to="/docs/intro"
              >
                Open docs
              </Link>
              <Link
                className={clsx(
                  'button button--secondary button--lg',
                  styles.secondaryButton
                )}
                to="/docs/using-the-idp"
              >
                Developer guide
              </Link>
            </div>
            <div className={styles.heroMetaRow}>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Primary audience</span>
                <strong>Application teams</strong>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Platform model</span>
                <strong>Applications and environments</strong>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Experience</span>
                <strong>Shared platform worldview</strong>
              </div>
            </div>
          </div>
          <div className={styles.heroConsole}>
            <div className={styles.consoleChrome}>
              <span />
              <span />
              <span />
            </div>
            <div className={styles.consoleBody}>
              <div className={styles.consoleSidebar}>
                <div className={styles.consoleSidebarItemActive}>
                  Documentation
                </div>
                <div className={styles.consoleSidebarItem}>Overview</div>
                <div className={styles.consoleSidebarItem}>Platform Model</div>
                <div className={styles.consoleSidebarItem}>Local Dev</div>
                <div className={styles.consoleSidebarItem}>Roadmap</div>
              </div>
              <div className={styles.consoleMain}>
                <div className={styles.consolePanel}>
                  <span className={styles.consolePanelLabel}>Overview</span>
                  <strong>Enter the IDP world</strong>
                  <p>
                    Learn how the portal describes environments, how the
                    platform hides raw infrastructure complexity, and where to
                    go next as a developer using the shared system.
                  </p>
                </div>
                <div className={styles.consoleStats}>
                  <div>
                    <span className={styles.consoleStatLabel}>
                      Platform language
                    </span>
                    <strong>Applications, resources, operations</strong>
                  </div>
                  <div>
                    <span className={styles.consoleStatLabel}>
                      What you get
                    </span>
                    <strong>Guides, context, and guardrails</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="Internal Developer Portal public documentation site"
    >
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
