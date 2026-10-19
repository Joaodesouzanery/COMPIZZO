load().then(render).catch(err => { $('#view').innerHTML = '<p class="bad">Erro ao carregar dados: ' + esc(err.message) + '</p>'; });
