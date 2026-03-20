import type { ReactNode } from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  eyebrow: string;
  title: string;
  description: ReactNode;
};

const featureList: FeatureItem[] = [
  {
    eyebrow: 'Application teams',
    title: 'Docs that speak the product language',
    description: (
      <>
        The documentation matches the console vocabulary: applications,
        environments, and operational workflows instead of raw infrastructure
        internals.
      </>
    ),
  },
  {
    eyebrow: 'Platform model',
    title: 'Infrastructure translated into a developer worldview',
    description: (
      <>
        The site frames Kubernetes and Crossplane as platform implementation
        details behind a cleaner application-environment mental model that is
        easier to navigate as a product, not just an ops stack.
      </>
    ),
  },
  {
    eyebrow: 'Orientation',
    title: 'A guided introduction to the shared platform',
    description: (
      <>
        Architecture, local development, operating context, and product guidance
        sit together so new developers can understand the IDP as a coherent
        environment before they ever need a specific workflow.
      </>
    ),
  },
];

function Feature({ eyebrow, title, description }: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <article className={styles.featureCard}>
        <p className={styles.featureEyebrow}>{eyebrow}</p>
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </article>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {featureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
