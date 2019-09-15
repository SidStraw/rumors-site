import gql from 'graphql-tag';
import { t, ngettext, msgid } from 'ttag';
import { useQuery } from '@apollo/react-hooks';
import Router from 'next/router';
import url from 'url';

import ButtonGroup from '@material-ui/core/ButtonGroup';
import Button from '@material-ui/core/Button';
import AppLayout from 'components/AppLayout';
import ArticleItem from 'components/ArticleItem';
import Pagination from 'components/Pagination';
import withData from 'lib/apollo';

const LIST_ARTICLES = gql`
  query ListArticles(
    $filter: ListArticleFilter
    $orderBy: [ListArticleOrderBy]
    $before: String
    $after: String
  ) {
    ListArticles(
      filter: $filter
      orderBy: $orderBy
      before: $before
      after: $after
      first: 25
    ) {
      edges {
        node {
          id
          text
          replyCount
          replyRequestCount
          createdAt
          references {
            type
          }
        }
        cursor
      }
    }
  }
`;

const LIST_STAT = gql`
  query ListArticlesStat(
    $filter: ListArticleFilter
    $orderBy: [ListArticleOrderBy]
  ) {
    ListArticles(filter: $filter, orderBy: $orderBy, first: 25) {
      pageInfo {
        firstCursor
        lastCursor
      }
      totalCount
    }
  }
`;

/**
 * @param {object} urlQuery - URL query object
 * @returns {object} ListArticleFilter
 */
function urlQuery2Filter({
  filter,
  q,
  replyRequestCount,
  searchUserByArticleId,
} = {}) {
  const filterObj = {};
  if (q) {
    filterObj.moreLikeThis = { like: q, minimumShouldMatch: '0' };
  }

  if (replyRequestCount) {
    filterObj.replyRequestCount = { GT: replyRequestCount - 1 };
  }

  if (filter === 'solved') {
    filterObj.replyCount = { GT: 0 };
  } else if (filter === 'unsolved') {
    filterObj.replyCount = { EQ: 0 };
  }

  if (searchUserByArticleId) {
    filterObj.fromUserOfArticleId = searchUserByArticleId;
  }

  // Return filterObj only when it is populated.
  if (!Object.keys(filterObj).length) {
    return undefined;
  }
  return filterObj;
}

/**
 * @param {object} urlQuery - URL query object
 * @returns {object[]} ListArticleOrderBy array
 */
function urlQuery2OrderBy({ q, orderBy = 'createdAt' } = {}) {
  // If there is query text, sort by _score first

  if (q) {
    return [{ _score: 'DESC' }, { [orderBy]: 'DESC' }];
  }

  return [{ [orderBy]: 'DESC' }];
}

/**
 * @param {object} urlQuery
 */
function goToUrlQueryAndResetPagination(urlQuery) {
  delete urlQuery.before;
  delete urlQuery.after;
  Router.push(`${location.pathname}${url.format({ query: urlQuery })}`);
}

function ArticleFilter({ filter = 'unsolved', onChange = () => {} }) {
  return (
    <ButtonGroup size="small" variant="outlined">
      <Button
        disabled={filter === 'unsolved'}
        onClick={() => onChange('unsolved')}
      >
        {t`Not replied`}
      </Button>
      <Button disabled={filter === 'solved'} onClick={() => onChange('solved')}>
        {t`Replied`}
      </Button>
      <Button disabled={filter === 'all'} onClick={() => onChange('all')}>
        {t`All`}
      </Button>
    </ButtonGroup>
  );
}

function ArticleListPage({ query }) {
  const listQueryVars = {
    filter: urlQuery2Filter(query),
    orderBy: urlQuery2OrderBy(query),
  };

  const {
    loading,
    data: { ListArticles: articleData },
  } = useQuery(LIST_ARTICLES, {
    variables: {
      ...listQueryVars,
      before: query.before,
      after: query.after,
    },
  });

  // Separate these stats query so that it will be cached by apollo-client and sends no network request
  // on page change, but still works when filter options are updated.
  //
  const {
    loading: statsLoading,
    data: { ListArticles: statsData },
  } = useQuery(LIST_STAT, {
    variables: listQueryVars,
  });

  return (
    <AppLayout>
      <main>
        <ArticleFilter
          filter={query.filter}
          onChange={newFilter =>
            goToUrlQueryAndResetPagination({ ...query, filter: newFilter })
          }
        />
        <p>
          {statsLoading
            ? 'Loading...'
            : ngettext(
                msgid`${statsData.totalCount} collected message`,
                `${statsData.totalCount} collected messages`,
                statsData.totalCount
              )}
        </p>
        <Pagination
          query={query}
          pageInfo={statsData && statsData.pageInfo}
          edges={articleData && articleData.edges}
        />
        {loading ? (
          'Loading....'
        ) : (
          <ul className="article-list">
            {articleData.edges.map(({ node }) => {
              return <ArticleItem key={node.id} article={node} />;
            })}
          </ul>
        )}
        <Pagination
          query={query}
          pageInfo={statsData && statsData.pageInfo}
          edges={articleData && articleData.edges}
        />
      </main>
      <style jsx>
        {`
          main {
            padding: 24px;
          }
          @media screen and (min-width: 768px) {
            main {
              padding: 40px;
            }
          }
          .article-list {
            padding: 0;
            list-style: none;
          }
        `}
      </style>
    </AppLayout>
  );
}

// Expose path query to component
ArticleListPage.getInitialProps = ({ query }) => ({ query });

export default withData(ArticleListPage);
