function showMsg( msg, type ) {
  let alertType = 'alert-info'

  if ( type === 'danger' )
    alertType = 'alert-danger'

  document.getElementById( 'footer' ).innerHTML = ''

  document.getElementById( 'data-body' ).innerHTML = `
        <div class="alert ${alertType} alert-dismissible fade show" role="alert">
            <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                <span aria-hidden="true">&times;</span>
            </button>
            ${msg}
        </div>
    `
}

function updateDT( data ) {
  // Remove any alerts, if any:
  if ( $( '.alert' ) )
    $( '.alert' ).remove()

  // Format dataset and redraw DataTable. Use second index for key name
  const forks = []
  for ( let fork of data ) {
    fork.repoLink = `<a href="https://github.com/${fork.full_name}">Link</a>`
    fork.ownerName = fork.owner.login
    forks.push( fork )
  }
  const dataSet = forks.map( fork => window.columnNamesMap.map( colNM => fork[colNM[1]] ) )
  window.forkTable.clear().rows.add( dataSet ).draw()
}

function initDT() {
  // Create ordered Object with column name and mapped display name
  window.columnNamesMap = [
    // [ 'Repository', 'full_name' ],
    ['Link', 'repoLink'],  // custom key
    ['Owner', 'ownerName'],  // custom key
    ['Name', 'name'],
    ['Branch', 'default_branch'],
    ['Stars', 'stargazers_count'],
    ['Watchers', 'watchers'],
    ['Forks', 'forks'],
    ['Size', 'size'],
    ['Last Push', 'pushed_at'],
  ]

  // Sort by stars:
  const sortColName = 'Stars'
  const sortColumnIdx = window.columnNamesMap.map( pair => pair[0] ).indexOf( sortColName )

  // Use first index for readable column name
  window.forkTable = $( '#forkTable' ).DataTable( {
    columns: window.columnNamesMap.map( colNM => {
      return {'title': colNM[0]}
    } ),
    'order': [[sortColumnIdx, 'desc']],
  } )
}

function fetchAndShow( repo ) {
  fetch( `https://api.github.com/repos/${repo}/forks?sort=stargazers` )
    .then( ( response ) => response.json() )
    .then( ( data ) => {
      updateDT( data )
    } )
}

function fetchData() {
  const repo = document.getElementById( 'q' ).value
  const re = /[-_\w]+\/[-_.\w]+/

  window.history.pushState( '', '', `?q=${repo}` )

  if ( re.test( repo ) )
    fetchAndShow( repo )
  else
    showMsg( 'Invalid GitHub repository! Format is &lt;username&gt;/&lt;repo&gt;', 'danger' )
}

document.getElementById( 'form' ).addEventListener( 'submit', ( e ) => {
  e.preventDefault()
  fetchData()
} )

function getQueryParams() {
  let query = location.search
  if ( !query )
    return { }

  return ( /^[?#]/.test( query ) ? query.slice( 1 ) : query )
    .split( '&' )
    .reduce( ( params, param ) => {
      let [ key, value ] = param.split( '=' )
      params[key] = value ? decodeURIComponent( value.replace( /\+/g, ' ' ) ) : ''
      return params
    }, { } )
}

window.addEventListener( 'load', () => {
  initDT()  // Initialize the DatatTable and window.columnNames variables

  // Get repository name from URL `http://.../?q=<repo>`
  const repo = getQueryParams().q
  if ( repo ) {
    document.getElementById( 'q' ).value = repo
    fetchData()
  }
} )

